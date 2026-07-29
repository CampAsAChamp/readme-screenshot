import { spawn, type ChildProcess } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findFreePort, interpolatePort, waitForHealth } from "../src/server.js";

describe("interpolatePort", () => {
  it("replaces all {port} placeholders", () => {
    expect(interpolatePort("http://127.0.0.1:{port}/health", 3456)).toBe(
      "http://127.0.0.1:3456/health",
    );
    expect(interpolatePort("yarn preview --port {port} --host {port}", 8080)).toBe(
      "yarn preview --port 8080 --host 8080",
    );
  });
});

describe("findFreePort", () => {
  it("returns a usable port on 127.0.0.1", async () => {
    const port = await findFreePort();
    expect(port).toBeGreaterThan(0);
    expect(Number.isInteger(port)).toBe(true);
  });
});

describe("waitForHealth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves when fetch returns ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);

    const proc = { exitCode: null, stderr: { read: () => null } } as unknown as ChildProcess;

    await expect(waitForHealth("http://127.0.0.1:9999/healthz", proc)).resolves.toBeUndefined();
  });

  it("rejects when the server process exits early", async () => {
    const proc = spawn("false", { shell: true });
    await new Promise<void>((resolve) => proc.on("close", () => resolve()));

    await expect(waitForHealth("http://127.0.0.1:9999/healthz", proc)).rejects.toThrow(
      /Server exited before becoming ready/,
    );
  });
});
