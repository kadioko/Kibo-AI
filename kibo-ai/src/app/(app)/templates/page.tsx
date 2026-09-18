const COMING = [
  {
    title: "Instagram Product Poster",
    detail: "Square format · portrait or product model · punchy short prompt",
  },
  {
    title: "TikTok Advertisement",
    detail: "9:16 · 5s video with audio · hook in the first second",
  },
  {
    title: "Cinematic Product Commercial",
    detail: "16:9 · 10s · slow camera move, rim light",
  },
  {
    title: "Product Photography",
    detail: "Studio light, macro detail, neutral backdrop",
  },
  {
    title: "Talking Product Demo",
    detail: "Presenter-style clip with generated audio",
  },
  {
    title: "Image-to-Video Animation",
    detail: "Start from a finished image, add motion",
  },
];

export default function TemplatesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
        <p className="mt-1 text-sm text-mute">
          One-click starting points — <span className="text-accent">Phase 2</span>: reusable,
          shareable, brand-aware.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {COMING.map((t) => (
          <div key={t.title} className="rounded-2xl border border-edge bg-panel p-4 opacity-80">
            <p className="font-semibold">{t.title}</p>
            <p className="mt-1 text-sm text-mute">{t.detail}</p>
            <p className="mt-3 inline-block rounded-full bg-panel-2 px-2.5 py-1 text-[11px] text-faint">
              Coming in Phase 2
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
