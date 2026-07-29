import { describe, expect, it } from "vitest";

import { DEFAULT_COMMIT_MESSAGE, getCommitMessage } from "../src/config.js";
import type { ReadmeScreenshotConfig } from "../src/config.js";

describe("getCommitMessage", () => {
  it("returns commit.message from config when set", () => {
    const config = {
      commit: { message: "docs: update dashboard screenshot" },
    } as ReadmeScreenshotConfig;

    expect(getCommitMessage(config)).toBe("docs: update dashboard screenshot");
  });

  it("falls back to the default when commit is omitted", () => {
    const config = {} as ReadmeScreenshotConfig;
    expect(getCommitMessage(config)).toBe(DEFAULT_COMMIT_MESSAGE);
  });
});
