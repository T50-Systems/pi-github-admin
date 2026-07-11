import { bench, describe } from "vitest";
import {
  addIssueLinksToPrBody,
  findMatchingIssue,
  normalizeComparableText,
  parseRepo,
} from "../src/api.js";

const issues = Array.from({ length: 100 }, (_, index) => ({
  title: `Roadmap item ${index}`,
  body: `Acceptance criteria for item ${index}`,
}));

describe("offline decision helpers", () => {
  bench("parse owner/name", () => {
    parseRepo("T50-Systems/pi-github-admin");
  });

  bench("normalize operator text", () => {
    normalizeComparableText("  Roadmap   FOUNDATION\nverification  ");
  });

  bench("match an issue in a 100-item page", () => {
    findMatchingIssue(
      issues,
      "roadmap item 99",
      "acceptance criteria for item 99",
      false,
    );
  });

  bench("deduplicate and append issue links", () => {
    addIssueLinksToPrBody("## Summary\nDone\n\nRefs #8\n", [8, 18, 18, 32], "refs");
  });
});
