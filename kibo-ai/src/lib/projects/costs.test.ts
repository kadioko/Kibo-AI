import { describe, expect, it } from "vitest";
import { summarizeProjectCosts } from "./costs";

describe("summarizeProjectCosts", () => {
  it("separates active estimates from completed final spend", () => {
    const totals = summarizeProjectCosts([
      { project_id: "p1", status: "completed", estimated_cost: 0.5, actual_cost: 0.45 },
      { project_id: "p1", status: "processing", estimated_cost: 0.25, actual_cost: null },
      { project_id: "p1", status: "failed", estimated_cost: 9, actual_cost: null },
      { project_id: null, status: "completed", estimated_cost: 4, actual_cost: 4 },
    ]).get("p1");

    expect(totals).toEqual({
      generation_count: 3,
      active_count: 1,
      failed_count: 1,
      estimated_cost: 0.75,
      actual_cost: 0.45,
    });
  });

  it("falls back to the locked estimate for historical completed rows", () => {
    const totals = summarizeProjectCosts([
      { project_id: "p1", status: "completed", estimated_cost: 0.1234, actual_cost: null },
    ]).get("p1");
    expect(totals?.actual_cost).toBe(0.1234);
  });
});
