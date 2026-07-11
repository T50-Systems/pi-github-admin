import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const [packageText, lockText, changelog] = await Promise.all([
  readFile(new URL("package.json", root), "utf8"),
  readFile(new URL("package-lock.json", root), "utf8"),
  readFile(new URL("CHANGELOG.md", root), "utf8"),
]);
const pkg = JSON.parse(packageText);
const lock = JSON.parse(lockText);
const errors = [];

if (lock.version !== pkg.version) {
  errors.push(`package-lock.json version ${lock.version} does not match package.json ${pkg.version}`);
}
if (lock.packages?.[""]?.version !== pkg.version) {
  errors.push(`lockfile root version ${lock.packages?.[""]?.version ?? "missing"} does not match ${pkg.version}`);
}

const escapedVersion = pkg.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const releaseHeading = new RegExp(`^## ${escapedVersion} - \\d{4}-\\d{2}-\\d{2}$`, "m");
if (!releaseHeading.test(changelog)) {
  errors.push(`CHANGELOG.md is missing a dated heading for ${pkg.version}`);
}

const suppliedTag = process.env.EXPECTED_RELEASE_TAG || process.env.GITHUB_REF_NAME;
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
