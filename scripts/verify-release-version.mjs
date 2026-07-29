import { readFileSync } from "node:fs";

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!tag) {
  console.error("Usage: node scripts/verify-release-version.mjs v1.1.0");
  process.exit(1);
}

function normalizeSemver(version) {
  const parts = version.replace(/^v/, "").split(".");
  return [parts[0] ?? "0", parts[1] ?? "0", parts[2] ?? "0"].join(".");
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const tagVersion = normalizeSemver(tag);
const pkgVersion = normalizeSemver(pkg.version);

if (tagVersion !== pkgVersion) {
  console.error(
    `Tag ${tag} (${tagVersion}) does not match package.json version ${pkg.version} (${pkgVersion})`,
  );
  process.exit(1);
}

console.log(`Version OK: ${pkgVersion}`);
