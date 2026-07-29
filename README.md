# readme-screenshot

Config-driven README screenshot automation for static sites and web apps.

Capture one or more themed Playwright screenshots and optionally blend them with [DiagonalBlend](https://github.com/CampAsAChamp/DiagonalBlend) for light/dark README hero images.

## Quick start

1. Add `.readme-screenshot.yml` to your repo (see [examples/portfolio.readme-screenshot.yml](examples/portfolio.readme-screenshot.yml)).
2. Install consumer deps and run capture:

```bash
npm install -g github:CampAsAChamp/readme-screenshot#v1
pip install "diagonal-blend @ git+https://github.com/CampAsAChamp/DiagonalBlend.git@67dc32c9a379"
npx playwright install chromium
readme-screenshot capture
```

3. Add a thin GitHub Actions workflow:

```yaml
jobs:
  screenshot:
    uses: CampAsAChamp/readme-screenshot/.github/workflows/capture-and-commit.yml@v1
    with:
      config: .readme-screenshot.yml
      commit_message: "docs: update readme screenshot"
      file_pattern: src/assets/website_screenshot.png
    permissions:
      contents: write
```

## CLI

```bash
readme-screenshot validate [--config .readme-screenshot.yml]
readme-screenshot capture [--config .readme-screenshot.yml]
```

## Config overview

| Section | Purpose |
|---------|---------|
| `output` | PNG path written in the consumer repo |
| `server` | Optional build/prepare, start command with `{port}`, health URL |
| `capture` | Viewport, target (`element` / `viewport` / `full_page`), masks, auth, clock |
| `theme` | Theme modes and how to set them before React boot |
| `blend` | Optional `diag_blend` step for multi-theme images |
| `commit` | Message hint for CI workflows |

JSON Schema for editor autocomplete: [schema/readme-screenshot.schema.json](schema/readme-screenshot.schema.json).

## Development

```bash
npm install
npm test
npm run build
node dist/cli.js validate --config examples/portfolio.readme-screenshot.yml
```

## License

MIT
