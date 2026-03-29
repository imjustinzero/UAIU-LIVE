import { useEffect, useMemo, useState } from "react";

export default function PortfolioTwinPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any>(null);
  useEffect(() => {
    fetch('/api/intelligence/events').then((r) => r.json()).then(setEvents);
    fetch('/api/portfolio/twin').then((r) => r.json()).then(setPortfolio);
  }, []);
  const riskScore = useMemo(() => Math.max(55, 90 - events.length * 2), [events]);

  return <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 space-y-4">
    <h1 className="text-3xl font-semibold">Portfolio Digital Twin</h1>
    <div className="grid md:grid-cols-4 gap-3">
      <Card title="Active projects" value={String(portfolio?.totalActiveProjects ?? 0)} />
      <Card title="Aggregate CO₂ rate" value={`${Number(portfolio?.aggregateCo2RateKgPerHour ?? 0).toFixed(2)} kg/h`} />
      <Card title="Aggregate credit rate" value={`${Number(portfolio?.aggregateCreditRatePerDay ?? 0).toFixed(2)} t/day`} />
      <Card title="Portfolio risk score" value={`${portfolio?.portfolioRiskScore ?? riskScore}`} />
    </div>
    <div className="rounded border border-white/20 bg-slate-900 p-4">
      <h2 className="font-medium mb-2">Portfolio Risk Matrix</h2>
      <div className="h-72 rounded bg-black/30 relative overflow-hidden">{Array.from({ length: 18 }).map((_, i) => <button key={i} className="absolute h-4 w-4 rounded-full" style={{ left: `${8 + (i * 5) % 85}%`, top: `${10 + (i * 9) % 75}%`, background: i % 4 === 0 ? '#ef4444' : '#22c55e' }} />)}</div>
    </div>
    <div className="rounded border border-white/20 bg-slate-900 p-4">
      <h2 className="font-medium mb-2">AI Portfolio Advisor</h2>
      <p className="text-sm text-white/80">Your portfolio has moderate concentration risk in tropical forestry projects. Consider increasing renewable and biogas exposure for weather and regulatory diversification.</p>
    </div>
  </div>;
}

function Card({ title, value }: { title: string; value: string }) {
  return <div className="rounded border border-white/20 bg-slate-900 p-3"><div className="text-xs text-white/70">{title}</div><div className="text-2xl font-semibold">{value}</div></div>;
}
