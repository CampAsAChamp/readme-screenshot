# readme-screenshot

Config-driven README screenshot automation for static sites and web apps.

Capture one or more themed Playwright screenshots and optionally blend them with [DiagonalBlend](https://github.com/CampAsAChamp/DiagonalBlend) for light/dark README hero images.

## Quick start

1. Add `.readme-screenshot.yml` to your repo (see [examples/portfolio.readme-screenshot.yml](examples/portfolio.readme-screenshot.yml) or [examples/fastapi.readme-screenshot.yml](examples/fastapi.readme-screenshot.yml) for Python web apps).
2. Install consumer deps and run capture:

```bash
npm install -g github:CampAsAChamp/readme-screenshot#v1.1.0
pip install "diagonal-blend @ git+https://github.com/CampAsAChamp/DiagonalBlend.git@main"
npx playwright install chromium
readme-screenshot capture
```

3. Add a thin GitHub Actions workflow:

```yaml
jobs:
  screenshot:
    uses: CampAsAChamp/readme-screenshot/.github/workflows/capture-and-commit.yml@v1.1.0
    with:
      config: .readme-screenshot.yml
      file_pattern: src/assets/website_screenshot.png
      pip_requirements: "requirements.txt requirements-dev.txt"  # optional, for Python apps
    permissions:
      contents: write
```

When `commit_message` is omitted, the workflow uses `commit.message` from your config file.

## CLI

```bash
readme-screenshot validate [--config .readme-screenshot.yml]
readme-screenshot capture [--config .readme-screenshot.yml]
readme-screenshot commit-message [--config .readme-screenshot.yml]
```

## Config overview

| Section   | Purpose                                                                     |
| --------- | --------------------------------------------------------------------------- |
| `output`  | PNG path written in the consumer repo                                       |
| `server`  | Optional build/prepare, start command with `{port}`, health URL             |
| `capture` | Viewport, target (`element` / `viewport` / `full_page`), masks, auth, clock |
| `theme`   | Theme modes and how to set them before React boot                           |
| `blend`   | Optional `diag_blend` step for multi-theme images                           |
| `commit`  | Default commit message for CI (used when workflow `commit_message` is empty) |

JSON Schema for editor autocomplete: [schema/readme-screenshot.schema.json](schema/readme-screenshot.schema.json).

Cross-field rules (blend order vs theme modes, theme keys for non-`default` modes) are enforced at runtime by Zod validation, not in the JSON Schema.

### Minimal static site

```yaml
version: 1
output: docs/screenshot.png
server:
  build: npm run build
  start: npx serve dist -l {port}
  health_url: "http://127.0.0.1:{port}/"
capture:
  viewport: { width: 1280, height: 720 }
  target: { type: viewport }
theme:
  modes: [default]
blend:
  enabled: false
commit:
  message: "docs: update readme screenshot"
```

### Server

| Field        | Description |
| ------------ | ----------- |
| `build`      | Optional shell command run before capture (e.g. `yarn build`) |
| `prepare`    | Optional one-off setup (e.g. seed a local database) |
| `start`      | Server command; `{port}` is replaced with a free port |
| `health_url` | URL polled until HTTP 200; use `{port}` like `start` |
| `cwd`        | Working directory for server commands (defaults to repo root) |
| `env`        | Extra environment variables for server commands |

### Capture

| Field                 | Description |
| --------------------- | ----------- |
| `viewport`            | Browser width and height in pixels |
| `target.type`         | `element` (CSS selector), `viewport`, or `full_page` |
| `target.selector`     | Required when `type` is `element` |
| `mask`                | Selectors hidden during screenshot (e.g. scroll indicators) |
| `base_url`            | Path appended to server origin (default `/`) |
| `wait_for_animations` | Wait for CSS transitions/animations to finish |
| `reduced_motion`      | Emulate `prefers-reduced-motion: reduce` |

#### Auth

For pages behind a login form:

```yaml
capture:
  auth:
    login_url: /login
    password_field: password   # optional, default "password"
    password: screenshot
    wait_for: ".dashboard-loaded"  # optional selector after login
```

#### Clock

Freeze browser time for deterministic screenshots:

```yaml
capture:
  clock:
    freeze: "2026-07-28T22:24:00Z"
    timezone: America/Los_Angeles   # optional
```

### Theme

Set `storage_key` and `attribute` when capturing multiple themes (e.g. light/dark). An init script sets the theme in storage and on the document root before React boots.

```yaml
theme:
  storage_key: color-mode
  attribute: color-mode
  modes: [dark, light]
```

Use `modes: [default]` for a single capture with no theme switching.

### Blend

When `blend.enabled: true`, capture each mode in `blend.order`, then merge with `diag_blend`:

```yaml
blend:
  enabled: true
  order: [dark, light]
  direction: tl-br    # or tr-bl
  blend_width: 150
```

Every id in `blend.order` must appear in `theme.modes`, and `direction` is required when blending is enabled.

### Commit

```yaml
commit:
  message: "docs: update readme screenshot"
```

Used by the reusable workflow when `commit_message` is not passed. Override per-run with the workflow input when needed.

## Troubleshooting

- **Playwright browser missing** — run `npx playwright install chromium` (add `--with-deps` in CI/Linux).
- **`diag_blend` not found** — install DiagonalBlend: `pip install "diagonal-blend @ git+https://github.com/CampAsAChamp/DiagonalBlend.git@main"`.
- **Server health timeout** — confirm `health_url` uses `{port}` and matches a route that returns HTTP 200 once the app is ready.
- **Blank or login-page screenshot** — check `capture.auth` credentials and set `wait_for` to a selector that appears only after login.
- **Theme not applied** — non-`default` modes require both `theme.storage_key` and `theme.attribute` matching your app's theme bootstrap.
- **Config validates in editor but fails at runtime** — the JSON Schema does not include all cross-field rules; run `readme-screenshot validate` locally.

## Development

```bash
npm install
npm test
npm run build
node dist/cli.js validate --config examples/portfolio.readme-screenshot.yml
node dist/cli.js validate --config examples/fastapi.readme-screenshot.yml
```

## Releasing

Releases are **tag-driven**, not automatic on every merge to `main`. Pushing a `v*` tag triggers [`.github/workflows/release.yml`](.github/workflows/release.yml), which:

1. Runs the full test suite
2. Validates both example configs
3. Verifies the tag matches `version` in [package.json](package.json) via [`scripts/verify-release-version.mjs`](scripts/verify-release-version.mjs)
4. Creates a GitHub Release with auto-generated notes

To cut a release:

1. Bump `version` in [package.json](package.json) and the CLI `--version` string in [src/cli.ts](src/cli.ts).
2. Merge to `main`.
3. Verify locally:

```bash
npm test
npm run verify-release -- v1.2.0
```

4. Tag and push:

```bash
git tag v1.2.0
git push origin main
git push origin v1.2.0
```

The tag must match `package.json` semver (`v1.2.0` → `1.2.0`). Shorthand tags like `v1.2` also match `1.2.0`.

Consumer repos pin the tag for installs and workflows:

```bash
npm install -g github:CampAsAChamp/readme-screenshot#v1.2.0
```

```yaml
uses: CampAsAChamp/readme-screenshot/.github/workflows/capture-and-commit.yml@v1.2.0
```

## License

MIT — see [LICENSE](LICENSE).
