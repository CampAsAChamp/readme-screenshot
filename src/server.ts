import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import type { Readable } from "node:stream";

import { logStep } from "./load-config.js";

const HEALTH_POLL_INTERVAL_MS = 250;
const HEALTH_TIMEOUT_MS = 60_000;
const SERVER_STOP_TIMEOUT_MS = 5_000;

function drainStream(stream: Readable | null | undefined): void {
  stream?.resume();
  stream?.on("data", () => {
    // Discard server output so pipe buffers cannot fill and block shutdown.
  });
}

function killProcessTree(proc: ChildProcess, signal: NodeJS.Signals): void {
  const pid = proc.pid;
  if (!pid) {
    return;
  }

  if (process.platform === "win32") {
    const args = ["/PID", String(pid), "/T"];
    if (signal === "SIGKILL") {
      args.push("/F");
    }

    try {
      spawn("taskkill", args, {
        shell: true,
        stdio: "ignore",
      });
    } catch {
      proc.kill(signal);
    }
    return;
  }

  const sigName = signal === "SIGKILL" ? "KILL" : "TERM";
  spawn("pkill", [`-${sigName}`, "-P", String(pid)], { stdio: "ignore" });

  try {
    proc.kill(signal);
  } catch {
    // Process may already be gone.
  }
}

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
  const proc = spawn(command, {
    cwd,
    env,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  drainStream(proc.stdout);
  drainStream(proc.stderr);

  return proc;
}

export async function stopServer(proc: ChildProcess): Promise<void> {
  if (proc.exitCode !== null || proc.signalCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    let graceTimeout: NodeJS.Timeout | undefined;
    let absoluteTimeout: NodeJS.Timeout | undefined;

    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(graceTimeout);
      clearTimeout(absoluteTimeout);
      resolve();
    };

    proc.once("close", finish);

    if (proc.exitCode !== null) {
      finish();
      return;
    }

    killProcessTree(proc, "SIGTERM");

    graceTimeout = setTimeout(() => {
      killProcessTree(proc, "SIGKILL");
    }, SERVER_STOP_TIMEOUT_MS);

    absoluteTimeout = setTimeout(() => {
      finish();
    }, SERVER_STOP_TIMEOUT_MS * 2);
  });
}
