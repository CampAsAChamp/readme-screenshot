#!/usr/bin/env node

import { Command } from "commander"

import { runCapture } from "./capture.js"
import { DEFAULT_CONFIG_PATH } from "./config.js"
import { loadConfig, logStep, validateConfig } from "./load-config.js"

const program = new Command()

program.name("readme-screenshot").description("Capture README screenshots from a config file").version("1.0.0")

program
  .command("validate")
  .description("Validate a readme-screenshot config file")
  .option("-c, --config <path>", "Path to config file", DEFAULT_CONFIG_PATH)
  .action(async (options: { config: string }) => {
    const config = await loadConfig(options.config)
    validateConfig(config)
    logStep(`Config is valid: ${options.config}`)
  })

program
  .command("capture")
  .description("Build, capture, and optionally blend README screenshots")
  .option("-c, --config <path>", "Path to config file", DEFAULT_CONFIG_PATH)
  .action(async (options: { config: string }) => {
    const config = await loadConfig(options.config)
    validateConfig(config)
    await runCapture(config, options.config)
  })

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  logStep(`Failed: ${message}`)
  process.exit(1)
})
