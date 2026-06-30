import { describe, expect, it } from "vitest";
import * as pkg from "../src/index.js";

describe("package exports", () => {
  it("exports the main helpers", () => {
    expect(typeof pkg.parseRepo).toBe("function");
    expect(typeof pkg.inspectGitHubAuth).toBe("function");
  });
});
