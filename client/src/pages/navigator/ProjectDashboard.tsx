import { useEffect, useState } from "react";
import { Link } from "wouter";
import { NavigatorLayout } from "@/components/navigator/NavigatorLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NavigatorProject({ params }: any) {
  const id = params.id;
  const [data, setData] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const r = await fetch(`/api/navigator/projects/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('session_id') || ''}` } }).then(r => r.json());
    setData(r);
    setLoading(false);
    if (!r.project?.readiness_score) {
      setLoading(true);
      const a = await fetch(`/api/navigator/projects/${id}/analyze`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${localStorage.getItem('session_id') || ''}` }, body: JSON.stringify({ project: r.project }) }).then(r => r.json());
      setAnalysis(a);
      setLoading(false);
    }
  })(); }, [id]);

  const a = analysis || data?.project;
  const score = a?.readiness_score || 0;
  const color = score <= 30 ? '#dc2626' : score <= 60 ? '#B45309' : score <= 85 ? '#15803D' : '#0D4F2F';

  return <NavigatorLayout>
    {loading ? <div className="space-y-2 rounded bg-white p-6"><div className="h-2 overflow-hidden rounded bg-[#D1FAE5]"><div className="h-full w-2/3 animate-pulse bg-[#15803D]"/></div><p>Analyzing project type... Matching Verra methodology... Calculating readiness score... Building your document checklist... Estimating timeline... Generating your roadmap...</p></div> :
    <div className="space-y-4">
      <Card className="p-5"><h1 className="text-2xl font-bold">{data?.project?.project_name}</h1><p className="text-[#475569]">{data?.project?.country} · {data?.project?.project_type}</p></Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5"><h3 className="mb-2 font-semibold">Readiness Score</h3><div className="text-5xl font-bold" style={{color}}>{score}</div></Card>
        <Card className="p-5"><h3 className="mb-2 font-semibold">Methodology Confirmation</h3><p>{a?.methodology || data?.project?.methodology_selected}</p><p className="mt-2 text-sm text-[#475569]">{a?.methodology_reasoning}</p></Card>
      </div>
      <Card className="p-5"><h3 className="mb-3 font-semibold">Milestone Timeline</h3><div className="flex gap-3 overflow-x-auto pb-2">{(a?.timeline||[]).map((t:any)=><div key={t.milestone} className="min-w-56 rounded border p-3"><p className="text-xs text-[#475569]">{t.month}</p><p className="font-medium">{t.milestone}</p><p className="text-sm text-[#475569]">{t.detail}</p></div>)}</div></Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5"><h3 className="font-semibold">Red Flags</h3>{(a?.red_flags||[]).map((r:string)=><div key={r} className="mt-2 rounded bg-[#FEF3C7] p-2 text-sm text-[#B45309]">{r}</div>)}</Card>
        <Card className="p-5"><h3 className="font-semibold">Next Actions</h3>{(a?.next_actions||[]).map((n:string)=><label key={n} className="mt-2 flex gap-2 text-sm"><input type="checkbox"/>{n}</label>)}</Card>
      </div>
      <div className="flex flex-wrap gap-2"><Link href={`/navigator/project/${id}/documents`}><Button className="h-11 bg-[#15803D]">Document Checklist</Button></Link><Link href={`/navigator/project/${id}/generate`}><Button variant="outline" className="h-11">Generate PDFs</Button></Link><Link href={`/navigator/project/${id}/vvb`}><Button variant="outline" className="h-11">Find VVB</Button></Link><Link href={`/navigator/project/${id}/tracker`}><Button variant="outline" className="h-11">Progress Tracker</Button></Link></div>
    </div>}
  </NavigatorLayout>;
}
