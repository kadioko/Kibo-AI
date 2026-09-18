const EXAMPLES = ["DukaPilot", "Necuva Group", "Primehaul"];

export default function BrandsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Brands</h1>
        <p className="mt-1 text-sm text-mute">
          Reusable brand profiles that shape every prompt —{" "}
          <span className="text-accent">Phase 2</span>.
        </p>
      </div>
      <div className="rounded-2xl border border-edge bg-panel p-5">
        <p className="font-medium">What a brand profile holds</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-mute">
          <li>Name, description, website, logo</li>
          <li>Brand colors, industry, target audience</li>
          <li>Preferred visual style and advertising tone</li>
          <li>Default call-to-action</li>
        </ul>
        <p className="mt-3 text-sm text-mute">
          When creating, you pick a brand and Kibo AI weaves its context into your prompt
          automatically.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {EXAMPLES.map((b) => (
          <div key={b} className="rounded-2xl border border-edge bg-panel p-4 opacity-80">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel-2 text-lg font-bold">
              {b[0]}
            </div>
            <p className="mt-2 font-semibold">{b}</p>
            <p className="mt-2 inline-block rounded-full bg-panel-2 px-2.5 py-1 text-[11px] text-faint">
              Coming in Phase 2
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
