import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverWorkflowFiles,
  validateWorkflowFile,
  validateWorkflows,
} from "../scripts/verify-workflows.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const fixtures = path.join(import.meta.dirname, "fixtures", "workflows");
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("offline workflow validation", () => {
  it("accepts every checked-in workflow", async () => {
    const result = await validateWorkflows(repositoryRoot);

    expect(result.files.map((file) => path.basename(file))).toEqual([
      "ci.yml",
      "release.yml",
    ]);
    expect(result.errors).toEqual([]);
  });

  it("discovers both yml and yaml workflow extensions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "pi-github-admin-workflows-"));
    temporaryRoots.push(root);
    const workflowDirectory = path.join(root, ".github", "workflows");
    await mkdir(workflowDirectory, { recursive: true });
    await Promise.all([
      writeFile(path.join(workflowDirectory, "first.yml"), "name: first\n"),
      writeFile(path.join(workflowDirectory, "second.yaml"), "name: second\n"),
      writeFile(path.join(workflowDirectory, "ignored.txt"), "not a workflow\n"),
    ]);

    const files = await discoverWorkflowFiles(root);

    expect(files.map((file) => path.basename(file))).toEqual([
      "first.yml",
      "second.yaml",
    ]);
  });

  it("reports a malformed fixture with a useful file and line", async () => {
    const errors = await validateWorkflowFile(
      path.join(fixtures, "malformed.yml"),
      repositoryRoot,
    );
    const output = errors.join("\n");

    expect(output).toContain(
      "tests/fixtures/workflows/malformed.yml:9:1 [yaml]",
    );
    expect(output).toContain("must be sufficiently indented and end with a ]");
  });

  it("rejects invalid workflow semantics", async () => {
    const errors = await validateWorkflowFile(
      path.join(fixtures, "invalid-semantic.yml"),
      repositoryRoot,
    );
    const output = errors.join("\n");

    expect(output).toContain("invalid-semantic.yml:4:3");
    expect(output).toContain('"runs-on" section is missing');
  });

  it("rejects mutable remote action references", async () => {
    const errors = await validateWorkflowFile(
      path.join(fixtures, "mutable-action.yml"),
      repositoryRoot,
    );

    expect(errors.join("\n")).toContain(
      "remote uses reference 'actions/checkout@v5' must use a full lowercase 40-character commit SHA or a sha256 container digest",
    );
  });

  it("requires review provenance beside immutable references", async () => {
    const errors = await validateWorkflowFile(
      path.join(fixtures, "missing-review-comment.yaml"),
      repositoryRoot,
    );

    expect(errors.join("\n")).toContain(
      "must end with a reviewed release or digest comment such as '# v5.0.1'",
    );
  });
});
