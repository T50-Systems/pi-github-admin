import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLinter } from "actionlint";
import { isScalar, LineCounter, parseDocument, visit } from "yaml";

const GITHUB_ACTION_PIN_PATTERN =
  /^[^\s/@]+\/[^\s/@]+(?:\/[^\s@]+)*@[0-9a-f]{40}$/;
const CONTAINER_ACTION_PIN_PATTERN =
  /^docker:\/\/[^\s@]+@sha256:[0-9a-f]{64}$/;
const REVIEW_COMMENT_PATTERN =
  /#\s*(?:v?\d+(?:\.\d+){0,2}(?:[-+][0-9A-Za-z.-]+)?|sha256:[0-9a-f]{12,64})\s*$/;

let actionlintPromise;

function displayPath(file, root = process.cwd()) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function getActionlint() {
  actionlintPromise ??= createLinter();
  return actionlintPromise;
}

function formatYamlIssue(file, root, issue) {
  const location = issue.linePos?.[0] ?? { line: 1, col: 1 };
  return `${displayPath(file, root)}:${location.line}:${location.col} [yaml] ${issue.message}`;
}

function isImmutableRemoteReference(reference) {
  return (
    GITHUB_ACTION_PIN_PATTERN.test(reference) ||
    CONTAINER_ACTION_PIN_PATTERN.test(reference)
  );
}

function validateLocalPolicy(file, root, source, document, lineCounter) {
  const errors = [];
  const lines = source.split(/\r?\n/);

  visit(document, {
    Pair(_key, pair) {
      if (!isScalar(pair.key) || pair.key.value !== "uses") return;

      const offset = pair.value?.range?.[0] ?? pair.key.range?.[0] ?? 0;
      const location = lineCounter.linePos(offset);
      const locationPrefix = `${displayPath(file, root)}:${location.line}:${location.col}`;

      if (!isScalar(pair.value) || typeof pair.value.value !== "string") {
        errors.push(`${locationPrefix} [policy] uses must be a scalar reference`);
        return;
      }

      const reference = pair.value.value;
      if (reference.startsWith("./")) return;

      if (!isImmutableRemoteReference(reference)) {
        errors.push(
          `${locationPrefix} [policy] remote uses reference '${reference}' must use a full lowercase 40-character commit SHA or a sha256 container digest`,
        );
        return;
      }

      const sourceLine = lines[location.line - 1] ?? "";
      if (!REVIEW_COMMENT_PATTERN.test(sourceLine)) {
        errors.push(
          `${locationPrefix} [policy] immutable reference '${reference}' must end with a reviewed release or digest comment such as '# v5.0.1'`,
        );
      }
    },
  });

  return errors;
}

export async function validateWorkflowFile(file, root = process.cwd()) {
  const source = await readFile(file, "utf8");
  const lineCounter = new LineCounter();
  const document = parseDocument(source, {
    lineCounter,
    prettyErrors: true,
    uniqueKeys: true,
  });
  const yamlIssues = [...document.errors, ...document.warnings];

  // actionlint@2.0.6 can trap inside WebAssembly on malformed flow YAML.
  // Parse first and return source-located YAML diagnostics instead of invoking it.
  if (yamlIssues.length > 0) {
    return [
      ...new Set(
        yamlIssues.map((issue) => formatYamlIssue(file, root, issue)),
      ),
    ];
  }

  const relativeFile = displayPath(file, root);
  const actionlint = await getActionlint();
  const errors = actionlint(source, relativeFile).map(
    (result) =>
      `${result.file}:${result.line}:${result.column} [${result.kind}] ${result.message}`,
  );
  errors.push(
    ...validateLocalPolicy(file, root, source, document, lineCounter),
  );

  return [...new Set(errors)];
}

export async function discoverWorkflowFiles(root = process.cwd()) {
  const directory = path.join(root, ".github", "workflows");
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(directory, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export async function validateWorkflows(root = process.cwd()) {
  const files = await discoverWorkflowFiles(root);
  if (files.length === 0) {
    throw new Error("no .yml or .yaml files found in .github/workflows");
  }

  const results = await Promise.all(
    files.map(async (file) => ({
      errors: await validateWorkflowFile(file, root),
      file,
    })),
  );

  return {
    errors: results.flatMap((result) => result.errors),
    files,
  };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = await validateWorkflows();
    if (result.errors.length > 0) {
      for (const error of result.errors) console.error(error);
      process.exitCode = 1;
    } else {
      console.log(
        `Offline workflow schema, semantic, expression, and immutable-reference validation passed (${result.files.length} files).`,
      );
    }
  } catch (error) {
    console.error(
      `Workflow validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
