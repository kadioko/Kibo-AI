import { describe, expect, it } from "vitest";
import { summarizeDatabaseChecks } from "./diagnostics";

describe("database diagnostics", () => {
  it("distinguishes denied reads from missing tables", () => {
    const result = summarizeDatabaseChecks([
      { name: "model_favorites", error: { code: "42501", message: "permission denied" } },
    ]);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("Permission denied: model_favorites");
    expect(result.detail).not.toContain("Missing tables");
  });
  it("reports absent relations, absent columns, and connection failures separately", () => {
    const result = summarizeDatabaseChecks([
      { name: "teams", error: { code: "PGRST205", message: "missing" } },
      { name: "generations", error: { code: "42703", message: "missing" } },
      { name: "providers", error: { message: "fetch failed" } },
    ]);
    expect(result.detail).toContain("Missing tables: teams");
    expect(result.detail).toContain("Missing columns in: generations");
    expect(result.detail).toContain("Could not verify: providers");
  });
  it("does not claim migrations are applied based only on successful reads", () => {
    const result = summarizeDatabaseChecks([{ name: "providers", error: null }]);
    expect(result).toEqual({ ok: true, detail: "Required tables and columns are accessible." });
  });
});
