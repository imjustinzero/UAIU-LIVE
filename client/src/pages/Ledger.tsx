import { useEffect, useState } from 'react';

type LedgerEntry = {
  tradeId: string;
  timestamp: string;
  creditType: string;
  registry: string;
  vintage: string;
  volumeTco2e: number;
  priceRange: string;
  framework: string;
};

type LedgerPayload = {
  totals: { trades: number; retiredTco2e: number; totalVolumeEur: number };
  entries: LedgerEntry[];
};

export default function LedgerPage() {
  const [data, setData] = useState<LedgerPayload | null>(null);

  useEffect(() => {
    document.title = 'Carbon Credit Trade Ledger | UAIU.LIVE';
    fetch('/api/public/ledger', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ totals: { trades: 0, retiredTco2e: 0, totalVolumeEur: 0 }, entries: [] }));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Public Trade Ledger</h1>
      <p className="mt-2 text-muted-foreground">{data?.totals.trades || 0} trades · {(data?.totals.retiredTco2e || 0).toLocaleString()} tCO2e retired · €{(data?.totals.totalVolumeEur || 0).toLocaleString()} volume</p>
      <div className="mt-6 overflow-x-auto rounded border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Trade ID</th><th className="p-2 text-left">Date</th><th className="p-2 text-left">Credit Type</th><th className="p-2 text-left">Registry</th><th className="p-2 text-left">Vintage</th><th className="p-2 text-left">Volume</th><th className="p-2 text-left">Price Range</th><th className="p-2 text-left">Framework</th>
            </tr>
          </thead>
          <tbody>
            {(data?.entries || []).map((e) => (
              <tr key={e.tradeId} className="border-t border-border">
                <td className="p-2">{e.tradeId}</td><td className="p-2">{new Date(e.timestamp).toLocaleString()}</td><td className="p-2">{e.creditType}</td><td className="p-2">{e.registry}</td><td className="p-2">{e.vintage}</td><td className="p-2">{e.volumeTco2e.toLocaleString()} tCO2e</td><td className="p-2">{e.priceRange}</td><td className="p-2">{e.framework}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
