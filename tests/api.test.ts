import { describe, expect, it } from "vitest";
import {
  findMatchingIssue,
  findMatchingRelease,
  normalizeComparableText,
  parseRepo,
} from "../src/api.js";

describe("parseRepo", () => {
  it("parses owner/name", () => {
    expect(parseRepo("T50-Systems/pi-thread-goal")).toEqual({ owner: "T50-Systems", name: "pi-thread-goal" });
  });

  it("throws on invalid repo", () => {
    expect(() => parseRepo("pi-thread-goal")).toThrow(/Invalid repo reference/);
  });
});

describe("normalizeComparableText", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeComparableText("  Hello   WORLD  ")).toBe("hello world");
  });
});

describe("findMatchingIssue", () => {
  it("matches normalized title and body", () => {
    const match = findMatchingIssue(
      [{ title: "Add  Repo", body: "Line one\nLine two" }],
      "add repo",
      "Line one Line two",
      false,
    );
    expect(match).toBeTruthy();
  });

  it("can match title only", () => {
    const match = findMatchingIssue([{ title: "Add Repo", body: "older body" }], "add repo", "new body", true);
    expect(match).toBeTruthy();
  });
});

describe("findMatchingRelease", () => {
  it("matches by tag first", () => {
    const match = findMatchingRelease([{ tag_name: "v1.0.0", name: "release", body: "notes" }], "v1.0.0", "x", "y", false);
    expect(match).toBeTruthy();
  });

  it("matches normalized title and notes", () => {
    const match = findMatchingRelease([{ tag_name: "old", name: "Initial Release", body: "Some notes" }], "new", "initial   release", "some notes", false);
    expect(match).toBeTruthy();
  });
});
