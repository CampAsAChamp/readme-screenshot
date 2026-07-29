import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { parse as parseYaml } from "yaml"

import { configSchema, DEFAULT_CONFIG_PATH, type ReadmeScreenshotConfig } from "./config.js"

export function logStep(message: string): void {
  console.error(`[*] ${message}`)
}

export async function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): Promise<ReadmeScreenshotConfig> {
  const absolutePath = resolve(process.cwd(), configPath)
  const raw = await readFile(absolutePath, "utf8")
  const parsed = parseYaml(raw)
  return configSchema.parse(parsed)
}

export function validateConfig(config: ReadmeScreenshotConfig): void {
  configSchema.parse(config)
}
