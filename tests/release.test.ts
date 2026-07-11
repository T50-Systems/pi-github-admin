import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const cwd = new URL("../", import.meta.url);

describe("release verification", () => {
	it("extracts only the matching changelog section", () => {
		const notes = execFileSync(process.execPath, ["scripts/extract-release-notes.mjs", "v0.6.0"], { cwd, encoding: "utf8" });
		expect(notes).toContain("Added in 0.6.0");
		expect(notes).not.toContain("0.5.0");
	});

	it("rejects a tag/package mismatch before release", () => {
		const result = spawnSync(process.execPath, ["scripts/verify-release.mjs"], {
			cwd,
			encoding: "utf8",
			env: { ...process.env, EXPECTED_RELEASE_TAG: "v9.9.9" },
		});
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("does not match package version v0.6.0");
	});
});
