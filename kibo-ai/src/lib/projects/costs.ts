export interface ProjectGenerationCost {
  project_id: string | null;
  status: string;
  estimated_cost: number | null;
  actual_cost: number | null;
}

export interface ProjectCostSummary {
  generation_count: number;
  active_count: number;
  failed_count: number;
  estimated_cost: number;
  actual_cost: number;
}

const EMPTY: ProjectCostSummary = {
  generation_count: 0,
  active_count: 0,
  failed_count: 0,
  estimated_cost: 0,
  actual_cost: 0,
};

/** Aggregate request quotes and recorded completed spend without double-counting failures. */
export function summarizeProjectCosts(
  rows: ProjectGenerationCost[],
): Map<string, ProjectCostSummary> {
  const totals = new Map<string, ProjectCostSummary>();

  for (const row of rows) {
    if (!row.project_id) continue;
    const current = totals.get(row.project_id) ?? { ...EMPTY };
    current.generation_count += 1;

    if (row.status === "queued" || row.status === "processing") {
      current.active_count += 1;
    }
    if (row.status === "failed" || row.status === "cancelled") {
      current.failed_count += 1;
    } else {
      current.estimated_cost += Number(row.estimated_cost ?? 0);
    }
    if (row.status === "completed") {
      current.actual_cost += Number(row.actual_cost ?? row.estimated_cost ?? 0);
    }

    totals.set(row.project_id, current);
  }

  for (const value of totals.values()) {
    value.estimated_cost = round4(value.estimated_cost);
    value.actual_cost = round4(value.actual_cost);
  }
  return totals;
}

export function emptyProjectCostSummary(): ProjectCostSummary {
  return { ...EMPTY };
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
