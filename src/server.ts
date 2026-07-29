import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";

import { logStep } from "./load-config.js";

const HEALTH_POLL_INTERVAL_MS = 250;
const HEALTH_TIMEOUT_MS = 60_000;

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate a free port"));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

export async function runShellCommand(
  command: string,
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  logStep(`Running: ${command}`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env,
      shell: true,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed with exit code ${code}: ${command}`));
    });
  });
}

export function interpolatePort(template: string, port: number): string {
  return template.replaceAll("{port}", String(port));
}

export async function waitForHealth(url: string, proc: ChildProcess): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      const stderr = proc.stderr?.read()?.toString() ?? "";
      throw new Error(`Server exited before becoming ready:\n${stderr}`);
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling
    }

    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_INTERVAL_MS));
  }

  throw new Error(`Server did not become ready within ${HEALTH_TIMEOUT_MS / 1000}s (${url})`);
}

export function startServer(command: string, cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
  logStep(`Starting server: ${command}`);
  return spawn(command, {
    cwd,
    env,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export async function stopServer(proc: ChildProcess): Promise<void> {
  if (proc.exitCode !== null) {
    return;
  }

  proc.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve();
    }, 5_000);

    proc.on("close", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
