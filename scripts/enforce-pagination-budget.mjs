import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_BENCHMARK = "guarded-pagination-maximum-collection";
const EXPECTED_FIXTURES = [
  "exact-boundary-not-truncated",
  "max-items",
  "max-pages",
  "repeated-link",
];

function finiteNumber(value, label, violations) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    violations.push(`${label} must be a finite non-negative number`);
    return undefined;
  }
  return value;
}

export function evaluatePaginationBudget(measurement, budget) {
  const violations = [];
  if (measurement?.schemaVersion !== 1) violations.push("measurement schemaVersion must be 1");
  if (budget?.schemaVersion !== 1) violations.push("budget schemaVersion must be 1");
  if (measurement?.benchmark !== EXPECTED_BENCHMARK) violations.push(`measurement benchmark must be ${EXPECTED_BENCHMARK}`);
  if (budget?.benchmark !== EXPECTED_BENCHMARK) violations.push(`budget benchmark must be ${EXPECTED_BENCHMARK}`);
  if (measurement?.configuration?.liveGitHubApi !== false) violations.push("measurement must declare liveGitHubApi=false");
  if (measurement?.configuration?.transport !== "deterministic-in-memory-fake") violations.push("measurement must use the deterministic in-memory fake");
  if (measurement?.configuration?.pages !== 100 || measurement?.configuration?.items !== 10_000) {
    violations.push("measurement must cover exactly 100 pages and 10,000 items");
  }
  const warmupRuns = measurement?.configuration?.warmupRuns;
  const sampleRuns = measurement?.configuration?.sampleRuns;
  if (!Number.isInteger(warmupRuns) || warmupRuns < 3 || !Number.isInteger(sampleRuns) || sampleRuns < 25) {
    violations.push("measurement must include at least 3 warmups and 25 samples");
  }
  if (!Array.isArray(measurement?.latencyMs?.samples) || measurement.latencyMs.samples.length < sampleRuns) {
    violations.push("measurement latency samples must contain every declared sample");
  }

  const fixtureNames = Array.isArray(measurement?.fixtures)
    ? measurement.fixtures.filter((fixture) => fixture?.passed === true).map((fixture) => fixture.name).sort()
    : [];
  if (JSON.stringify(fixtureNames) !== JSON.stringify(EXPECTED_FIXTURES)) {
    violations.push(`measurement must pass fixtures: ${EXPECTED_FIXTURES.join(", ")}`);
  }

  const observed = {
    p99LatencyMs: finiteNumber(measurement?.latencyMs?.p99, "latencyMs.p99", violations),
    peakRssBytes: finiteNumber(measurement?.memoryBytes?.peakRss, "memoryBytes.peakRss", violations),
    peakHeapUsedBytes: finiteNumber(measurement?.memoryBytes?.peakHeapUsed, "memoryBytes.peakHeapUsed", violations),
  };
  const limits = {
    p99LatencyMs: finiteNumber(budget?.limits?.p99LatencyMs, "limits.p99LatencyMs", violations),
    peakRssBytes: finiteNumber(budget?.limits?.peakRssBytes, "limits.peakRssBytes", violations),
    peakHeapUsedBytes: finiteNumber(budget?.limits?.peakHeapUsedBytes, "limits.peakHeapUsedBytes", violations),
  };

  for (const metric of Object.keys(observed)) {
    if (observed[metric] !== undefined && limits[metric] !== undefined && observed[metric] > limits[metric]) {
      violations.push(`${metric} ${observed[metric]} exceeds limit ${limits[metric]}`);
    }
  }

  return { ok: violations.length === 0, benchmark: budget?.benchmark, observed, limits, violations };
}

export async function enforcePaginationBudget(measurementPath, budgetPath) {
  const [measurement, budget] = await Promise.all([
    readFile(measurementPath, "utf8").then(JSON.parse),
    readFile(budgetPath, "utf8").then(JSON.parse),
  ]);
  return evaluatePaginationBudget(measurement, budget);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const measurementPath = path.resolve(process.argv[2] ?? "artifacts/pagination-benchmark.json");
  const budgetPath = path.resolve(process.argv[3] ?? "scripts/pagination-budget.json");
  const outputPath = path.resolve(process.env.PAGINATION_BUDGET_OUTPUT ?? "artifacts/pagination-budget-result.json");
  try {
    const result = await enforcePaginationBudget(measurementPath, budgetPath);
    const serialized = JSON.stringify(result);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(`PAGINATION_BUDGET_RESULT=${serialized}`);
    if (!result.ok) {
      for (const violation of result.violations) console.error(`Pagination budget violation: ${violation}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`Pagination budget enforcement failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
