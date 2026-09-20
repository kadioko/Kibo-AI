import { AdminCreditGrant } from "@/components/admin-credit-grant";
import { getAdminOverview } from "@/lib/admin";

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default async function AdminPage() {
  const overview = await getAdminOverview();
  const metrics = [
    ["Users", String(overview.userCount)],
    ["All generations", String(overview.generationCount)],
    ["Active queue", String(overview.activeGenerationCount)],
    ["Provider spend · 30d", currency(overview.spendLast30Days)],
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Operations console</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-mute">Live system activity, user support, and audited credit controls.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-edge bg-panel p-4">
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-mute">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-2xl border border-edge bg-panel p-4">
          <h2 className="font-semibold">Recent generation queue</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-faint"><th className="pb-2 pr-3">Model</th><th className="pb-2 pr-3">Type</th><th className="pb-2 pr-3">Status</th><th className="pb-2 text-right">Cost</th></tr></thead>
              <tbody>
                {overview.recentGenerations.map((item) => <tr key={item.id} className="border-t border-edge"><td className="py-2.5 pr-3">{item.model}</td><td className="py-2.5 pr-3 text-mute">{item.type}</td><td className="py-2.5 pr-3">{item.status}</td><td className="py-2.5 text-right tabular-nums">{item.status === "failed" || item.status === "cancelled" ? "Not charged" : `${item.status === "completed" ? "Final " : "Est. "}${item.actualCost == null && item.estimatedCost == null ? "—" : currency(Number(item.actualCost ?? item.estimatedCost))}`}</td></tr>)}
                {overview.recentGenerations.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-sm text-mute">No generations yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <AdminCreditGrant users={overview.users} />
      </div>
      <section className="rounded-2xl border border-edge bg-panel p-4">
        <h2 className="font-semibold">Account access</h2>
        <p className="mt-1 text-sm text-mute">Application administrators have complimentary Kibo credit checks while provider costs remain visible in usage reporting. Generation rate limits remain in place to protect the service.</p>
      </section>
    </div>
  );
}
