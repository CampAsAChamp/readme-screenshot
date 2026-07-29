import { copyFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";

import { diagonalBlendInstallSpec, type ReadmeScreenshotConfig } from "./config.js";
import { logStep } from "./load-config.js";

export async function blendCaptures(
  config: ReadmeScreenshotConfig,
  captures: Map<string, string>,
  outputPath: string,
): Promise<void> {
  if (!config.blend.enabled) {
    const singleMode = config.theme.modes[0];
    if (!singleMode) {
      throw new Error("No theme modes configured");
    }
    const source = captures.get(singleMode);
    if (!source) {
      throw new Error(`Missing capture for theme mode "${singleMode}"`);
    }
    await mkdir(dirname(outputPath), { recursive: true });
    await copyFile(source, outputPath);
    logStep(`Saved screenshot to ${outputPath}`);
    return;
  }

  const order = config.blend.order ?? [];
  const img1 = captures.get(order[0] ?? "");
  const img2 = captures.get(order[1] ?? "");

  if (!img1 || !img2) {
    throw new Error(`Missing captures for blend order: ${order.join(", ")}`);
  }

  const args = [
    img1,
    img2,
    "-o",
    outputPath,
    "--direction",
    config.blend.direction ?? "tl-br",
    "--blend-width",
    String(config.blend.blend_width),
  ];

  logStep(`Blending captures with diag_blend`);
  await mkdir(dirname(outputPath), { recursive: true });

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn("diag_blend", args, {
      stdio: "inherit",
    });
    child.on("error", (error) => {
      reject(
        new Error(
          `Failed to run diag_blend: ${error.message}. Install with: pip install "${diagonalBlendInstallSpec()}"`,
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`diag_blend failed with exit code ${code}`));
    });
  });

  logStep(`Saved blended screenshot to ${outputPath}`);
}

export function resolveOutputPath(output: string, cwd: string = process.cwd()): string {
  return resolve(cwd, output);
}
