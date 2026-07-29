import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { blendCaptures } from "../src/blend.js";
import type { ReadmeScreenshotConfig } from "../src/config.js";

describe("blendCaptures", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("copies the single theme capture when blend is disabled", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "readme-screenshot-blend-"));
    const sourcePath = join(tempDir, "default.png");
    const outputPath = join(tempDir, "out", "screenshot.png");
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await writeFile(sourcePath, pngHeader);

    const config = {
      blend: { enabled: false, blend_width: 150 },
      theme: { modes: ["default"] },
    } as ReadmeScreenshotConfig;

    const captures = new Map([["default", sourcePath]]);

    await blendCaptures(config, captures, outputPath);

    const output = await readFile(outputPath);
    expect(output.equals(pngHeader)).toBe(true);
  });
});
