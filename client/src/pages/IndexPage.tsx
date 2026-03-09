import { useEffect, useState } from 'react';

type Series = { name: string; thisWeek: number; lastWeek: number; changePct: number; volume: number; trades: number; range: string };

export default function IndexPage() {
  const [rows, setRows] = useState<Series[]>([]);
  useEffect(() => {
    document.title = 'Carbon Credit Price Index | UAIU.LIVE';
    fetch('/api/public/index', { cache: 'no-store' }).then((r) => r.json()).then((p) => setRows(p.indices || [])).catch(() => setRows([]));
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">UAIU Carbon Price Index</h1>
      <p className="text-muted-foreground mt-2">Updated weekly (Monday 9am EST)</p>
      <div className="mt-6 grid gap-4">
        {rows.map((r) => (
          <div key={r.name} className="rounded border border-border p-4">
            <div className="font-semibold">{r.name}</div>
            <div>${r.thisWeek.toFixed(2)} / tonne ({r.changePct >= 0 ? '+' : ''}{r.changePct.toFixed(1)}%)</div>
            <div className="text-sm text-muted-foreground">Trades: {r.trades} · Volume: {r.volume.toLocaleString()} tCO2e · Range: {r.range}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
