import { describe, expect, it } from "vitest";

import { configSchema } from "../src/config.js";

describe("configSchema", () => {
  it("accepts a portfolio-style blended config", () => {
    const config = configSchema.parse({
      version: 1,
      output: "src/assets/website_screenshot.png",
      server: {
        build: "yarn build",
        start: "yarn preview --host 127.0.0.1 --port {port}",
        health_url: "http://127.0.0.1:{port}/",
      },
      capture: {
        viewport: { width: 1280, height: 900 },
        target: { type: "element", selector: "#landing-page-container" },
        mask: ["#mouse-scroll-indicator"],
        wait_for_animations: true,
        reduced_motion: true,
      },
      theme: {
        storage_key: "color-mode",
        attribute: "color-mode",
        modes: ["dark", "light"],
      },
      blend: {
        enabled: true,
        order: ["dark", "light"],
        direction: "tl-br",
        blend_width: 150,
      },
    });

    expect(config.blend.enabled).toBe(true);
  });

  it("accepts a single-capture config without blend", () => {
    const config = configSchema.parse({
      version: 1,
      output: "docs/dashboard.png",
      server: {
        start: "python -m uvicorn src.main:app --host 127.0.0.1 --port {port}",
        health_url: "http://127.0.0.1:{port}/healthz",
      },
      capture: {
        viewport: { width: 1280, height: 900 },
        target: { type: "full_page" },
      },
      theme: {
        modes: ["default"],
      },
      blend: {
        enabled: false,
      },
    });

    expect(config.theme.modes).toEqual(["default"]);
  });

  it("rejects blend order that references unknown theme modes", () => {
    expect(() =>
      configSchema.parse({
        version: 1,
        output: "out.png",
        server: {
          start: "yarn preview --port {port}",
          health_url: "http://127.0.0.1:{port}/",
        },
        capture: {
          viewport: { width: 1280, height: 900 },
          target: { type: "viewport" },
        },
        theme: {
          storage_key: "color-mode",
          attribute: "color-mode",
          modes: ["dark", "light"],
        },
        blend: {
          enabled: true,
          order: ["dark", "missing"],
          direction: "tl-br",
        },
      }),
    ).toThrow();
  });
});
