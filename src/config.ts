import { z } from "zod";

const viewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const targetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("element"),
    selector: z.string().min(1),
  }),
  z.object({
    type: z.literal("viewport"),
  }),
  z.object({
    type: z.literal("full_page"),
  }),
]);

const authSchema = z.object({
  login_url: z.string().min(1),
  password_field: z.string().default("password"),
  password: z.string(),
  wait_for: z.string().optional(),
});

const clockSchema = z.object({
  freeze: z.string().min(1),
  timezone: z.string().optional(),
});

export const configSchema = z
  .object({
    version: z.literal(1),
    output: z.string().min(1),
    server: z.object({
      build: z.string().optional(),
      prepare: z.string().optional(),
      start: z.string().min(1),
      health_url: z.string().min(1),
      cwd: z.string().optional(),
      env: z.record(z.string()).optional(),
    }),
    capture: z.object({
      viewport: viewportSchema,
      target: targetSchema,
      mask: z.array(z.string()).optional(),
      wait_for_animations: z.boolean().default(true),
      reduced_motion: z.boolean().default(true),
      base_url: z.string().default("/"),
      auth: authSchema.optional(),
      clock: clockSchema.optional(),
    }),
    theme: z.object({
      storage_key: z.string().optional(),
      attribute: z.string().optional(),
      modes: z.array(z.string()).min(1),
    }),
    blend: z
      .object({
        enabled: z.boolean().default(false),
        order: z.array(z.string()).optional(),
        direction: z.enum(["tl-br", "tr-bl"]).optional(),
        blend_width: z.number().int().positive().default(150),
      })
      .default({ enabled: false }),
    commit: z
      .object({
        message: z.string().default("docs: update readme screenshot"),
      })
      .optional(),
  })
  .superRefine((config, ctx) => {
    if (config.blend.enabled) {
      if (!config.blend.order || config.blend.order.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "blend.order must list at least two theme mode ids when blend.enabled is true",
          path: ["blend", "order"],
        });
      } else {
        for (const mode of config.blend.order) {
          if (!config.theme.modes.includes(mode)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `blend.order references unknown theme mode "${mode}"`,
              path: ["blend", "order"],
            });
          }
        }
      }
      if (!config.blend.direction) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "blend.direction is required when blend.enabled is true",
          path: ["blend", "direction"],
        });
      }
    }

    if (config.capture.target.type === "element" && !config.capture.target.selector) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "capture.target.selector is required for element targets",
        path: ["capture", "target", "selector"],
      });
    }

    const hasThemeOverride = config.theme.modes.some((mode) => mode !== "default");
    if (hasThemeOverride && (!config.theme.storage_key || !config.theme.attribute)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "theme.storage_key and theme.attribute are required when using themed captures",
        path: ["theme"],
      });
    }
  });

export type ReadmeScreenshotConfig = z.infer<typeof configSchema>;

export const DEFAULT_CONFIG_PATH = ".readme-screenshot.yml";

export const DIAGONAL_BLEND_REPO_URL = "git+https://github.com/CampAsAChamp/DiagonalBlend.git";

export const DEFAULT_COMMIT_MESSAGE = "docs: update readme screenshot";

export function diagonalBlendInstallSpec(ref = "main"): string {
  return `diagonal-blend @ ${DIAGONAL_BLEND_REPO_URL}@${ref}`;
}

export function getCommitMessage(
  config: ReadmeScreenshotConfig,
  fallback = DEFAULT_COMMIT_MESSAGE,
): string {
  return config.commit?.message ?? fallback;
}
