import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { parse } from "yaml";

const root = new URL("../", import.meta.url);
const [packageText, lockText, changelog] = await Promise.all([
  readFile(new URL("package.json", root), "utf8"),
  readFile(new URL("pnpm-lock.yaml", root), "utf8"),
  readFile(new URL("CHANGELOG.md", root), "utf8"),
]);
const pkg = JSON.parse(packageText);
const lock = parse(lockText);
const errors = [];

if (Number(lock.lockfileVersion) !== 9 || !lock.importers?.["."]) {
  errors.push("pnpm-lock.yaml must use the supported format and contain the root importer");
}
for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
  for (const [name, specifier] of Object.entries(pkg[section] ?? {})) {
    if (lock.importers?.["."]?.[section]?.[name]?.specifier !== specifier) {
      errors.push(`pnpm-lock.yaml must preserve the declared ${name} specification`);
    }
  }
}

const escapedVersion = pkg.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const releaseHeading = new RegExp(`^## ${escapedVersion} - \\d{4}-\\d{2}-\\d{2}$`, "m");
if (!releaseHeading.test(changelog)) {
  errors.push(`CHANGELOG.md is missing a dated heading for ${pkg.version}`);
}

const githubTag = process.env.GITHUB_REF_TYPE === "tag" || process.env.GITHUB_REF?.startsWith("refs/tags/")
	? process.env.GITHUB_REF_NAME
	: undefined;
const suppliedTag = process.env.EXPECTED_RELEASE_TAG || githubTag;
if (suppliedTag && suppliedTag !== `v${pkg.version}`) {
	errors.push(`release tag ${suppliedTag} does not match package version v${pkg.version}`);
}

if (process.env.VERIFY_RELEASE_TAG === "1") {
  const expectedTag = `v${pkg.version}`;
  try {
    execFileSync("git", ["rev-parse", "--verify", `refs/tags/${expectedTag}`], {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    errors.push(`git tag ${expectedTag} does not exist`);
  }
}

if (errors.length) {
  console.error("Release verification failed:\n- " + errors.join("\n- "));
  process.exitCode = 1;
} else {
  console.log(`Release metadata verified for ${pkg.name}@${pkg.version}.`);
}
