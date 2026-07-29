import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { chromium, type Browser, type BrowserContext, type Page } from "playwright"

import { blendCaptures, resolveOutputPath } from "./blend.js"
import type { ReadmeScreenshotConfig } from "./config.js"
import { logStep } from "./load-config.js"
import {
  findFreePort,
  interpolatePort,
  runShellCommand,
  startServer,
  stopServer,
  waitForHealth,
} from "./server.js"

async function waitForImages(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const images = Array.from(document.querySelectorAll("img"))
        const viewportImages = images.filter((img) => {
          const rect = img.getBoundingClientRect()
          return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0 && rect.height > 0
        })
        return viewportImages.length === 0 || viewportImages.every((img) => img.complete && img.naturalHeight > 0)
      },
      undefined,
      { timeout: 5_000 },
    )
    .catch(() => undefined)
}

async function waitForFonts(page: Page): Promise<void> {
  await page
    .waitForFunction(() => document.fonts.status === "loaded", undefined, { timeout: 5_000 })
    .catch(() => undefined)
}

async function waitForAnimations(page: Page, selector?: string): Promise<void> {
  await page.evaluate((targetSelector) => {
    const elements = targetSelector
      ? [document.querySelector(targetSelector)].filter(Boolean)
      : Array.from(document.querySelectorAll("*"))

    return Promise.all(
      elements.flatMap((element) =>
        element ? Array.from(element.getAnimations()).map((animation) => animation.finished.catch(() => undefined)) : [],
      ),
    )
  }, selector)
}

function buildThemeInitScript(storageKey: string, attribute: string, mode: string): string {
  return `(() => {
    localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(mode)});
    document.documentElement.setAttribute(${JSON.stringify(attribute)}, ${JSON.stringify(mode)});
  })();`
}

async function createContext(
  browser: Browser,
  config: ReadmeScreenshotConfig,
  themeMode: string,
): Promise<BrowserContext> {
  const contextOptions: Parameters<Browser["newContext"]>[0] = {
    viewport: config.capture.viewport,
    reducedMotion: config.capture.reduced_motion ? "reduce" : "no-preference",
  }

  if (config.capture.clock?.timezone) {
    contextOptions.timezoneId = config.capture.clock.timezone
  }

  const context = await browser.newContext(contextOptions)

  if (config.capture.clock?.freeze) {
    await context.clock.install({ time: new Date(config.capture.clock.freeze) })
  }

  const usesTheme = themeMode !== "default" && config.theme.storage_key && config.theme.attribute
  if (usesTheme) {
    await context.addInitScript(
      buildThemeInitScript(config.theme.storage_key!, config.theme.attribute!, themeMode),
    )
  }

  return context
}

async function performAuth(page: Page, baseUrl: string, config: ReadmeScreenshotConfig): Promise<void> {
  const auth = config.capture.auth
  if (!auth) {
    return
  }

  await page.goto(new URL(auth.login_url, baseUrl).toString(), { waitUntil: "networkidle" })
  await page.evaluate(() => localStorage.clear())
  await page.fill(`input[name="${auth.password_field}"]`, auth.password)
  await page.click('button[type="submit"]')
  await page.waitForLoadState("networkidle")

  if (auth.wait_for) {
    await page.waitForSelector(auth.wait_for)
  }
}

async function captureTheme(
  browser: Browser,
  config: ReadmeScreenshotConfig,
  baseUrl: string,
  themeMode: string,
  outputFile: string,
): Promise<void> {
  const context = await createContext(browser, config, themeMode)
  const page = await context.newPage()

  try {
    if (config.capture.auth) {
      await performAuth(page, baseUrl, config)
    }

    await page.goto(new URL(config.capture.base_url, baseUrl).toString(), { waitUntil: "domcontentloaded" })

    if (config.capture.wait_for_animations) {
      const selector = config.capture.target.type === "element" ? config.capture.target.selector : undefined
      await waitForAnimations(page, selector)
    }

    await waitForImages(page)
    await waitForFonts(page)

    const maskLocators = (config.capture.mask ?? []).map((selector) => page.locator(selector))

    if (config.capture.target.type === "element") {
      const target = page.locator(config.capture.target.selector)
      await target.waitFor({ state: "visible", timeout: 15_000 })
      await target.screenshot({ path: outputFile, animations: "disabled", mask: maskLocators })
    } else if (config.capture.target.type === "full_page") {
      await page.screenshot({ path: outputFile, fullPage: true, animations: "disabled", mask: maskLocators })
    } else {
      await page.screenshot({ path: outputFile, animations: "disabled", mask: maskLocators })
    }

    logStep(`Captured ${themeMode} screenshot -> ${outputFile}`)
  } finally {
    await context.close()
  }
}

export async function runCapture(config: ReadmeScreenshotConfig, configPath: string): Promise<void> {
  const cwd = process.cwd()
  const outputPath = resolveOutputPath(config.output, cwd)
  const tempDir = await mkdtemp(join(tmpdir(), "readme-screenshot-"))

  try {
    if (config.server.build) {
      logStep("Building project")
      await runShellCommand(config.server.build, config.server.cwd ? resolve(cwd, config.server.cwd) : cwd)
    }

    if (config.server.prepare) {
      logStep("Running prepare step")
      await runShellCommand(config.server.prepare, config.server.cwd ? resolve(cwd, config.server.cwd) : cwd, {
        ...process.env,
        ...config.server.env,
      })
    }

    const port = await findFreePort()
    const startCommand = interpolatePort(config.server.start, port)
    const healthUrl = interpolatePort(config.server.health_url, port)
    const serverCwd = config.server.cwd ? resolve(cwd, config.server.cwd) : cwd
    const serverEnv = { ...process.env, ...config.server.env }

    const server = startServer(startCommand, serverCwd, serverEnv)

    try {
      await waitForHealth(healthUrl, server)
      const baseUrl = new URL(healthUrl).origin

      const browser = await chromium.launch({ headless: true })
      const captures = new Map<string, string>()

      try {
        for (const mode of config.theme.modes) {
          const capturePath = join(tempDir, `${mode}.png`)
          await captureTheme(browser, config, baseUrl, mode, capturePath)
          captures.set(mode, capturePath)
        }
      } finally {
        await browser.close()
      }

      await blendCaptures(config, captures, outputPath)
      logStep(`Capture complete (${configPath})`)
    } finally {
      logStep("Stopping server")
      await stopServer(server)
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
