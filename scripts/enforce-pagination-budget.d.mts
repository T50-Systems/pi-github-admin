export interface PaginationBudgetResult {
  ok: boolean;
  benchmark?: string;
  observed: {
    p99LatencyMs?: number;
    peakRssBytes?: number;
    peakHeapUsedBytes?: number;
  };
  limits: {
    p99LatencyMs?: number;
    peakRssBytes?: number;
    peakHeapUsedBytes?: number;
  };
  violations: string[];
}

export function evaluatePaginationBudget(
  measurement: unknown,
  budget: unknown,
): PaginationBudgetResult;

export function enforcePaginationBudget(
  measurementPath: string,
  budgetPath: string,
): Promise<PaginationBudgetResult>;
