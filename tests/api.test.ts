import { describe, expect, it } from "vitest";
import {
  createIssueComment,
  createPullRequestComment,
  deleteComment,
  editComment,
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

describe("comment helpers", () => {
  it("supports issue comment dry run", async () => {
    const result = await createIssueComment({
      repo: "T50-Systems/repuestos",
      issueNumber: 218,
      body: "hello",
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.url).toBe("https://github.com/T50-Systems/repuestos/issues/218");
    expect(result.operation).toBe("comment_issue");
  });

  it("supports pr comment dry run", async () => {
    const result = await createPullRequestComment({
      repo: "T50-Systems/repuestos",
      pullNumber: 217,
      body: "hello",
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.url).toBe("https://github.com/T50-Systems/repuestos/pull/217");
    expect(result.operation).toBe("comment_pr");
  });

  it("supports edit comment dry run", async () => {
    const result = await editComment({
      repo: "T50-Systems/repuestos",
      commentId: 123,
      body: "updated",
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.operation).toBe("edit_comment");
  });

  it("supports delete comment dry run", async () => {
    const result = await deleteComment({
      repo: "T50-Systems/repuestos",
      commentId: 123,
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.operation).toBe("delete_comment");
  });
});
