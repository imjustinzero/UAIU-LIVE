import { useEffect, useMemo, useState } from "react";
import { NavigatorLayout } from "@/components/navigator/NavigatorLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function NavigatorVvb({ params }: any) {
  const id = params.id;
  const [vvbs, setVvbs] = useState<any[]>([]);
  const [scope, setScope] = useState('');
  const [region, setRegion] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [message, setMessage] = useState('Please share your validation and verification proposal.');
  useEffect(() => { fetch('/api/navigator/vvbs').then(r=>r.json()).then(setVvbs); }, []);
  const filtered = useMemo(()=>vvbs.filter(v=> (!scope||v.specializations.some((s:string)=>s.toLowerCase().includes(scope.toLowerCase()))) && (!region||v.regions.some((r:string)=>r.toLowerCase().includes(region.toLowerCase())))),[vvbs,scope,region]);
  return <NavigatorLayout>
    <Card className="mb-4 p-5"><h1 className="text-2xl font-semibold">Find Your Validation & Verification Body</h1><p className="mt-2 text-sm text-[#475569]">A VVB is an independent auditor accredited by Verra. Typical cost: $15,000–$80,000.</p></Card>
    <div className="mb-4 grid gap-2 md:grid-cols-3"><input className="h-11 rounded border px-3" placeholder="Filter by scope" value={scope} onChange={e=>setScope(e.target.value)}/><input className="h-11 rounded border px-3" placeholder="Filter by region" value={region} onChange={e=>setRegion(e.target.value)}/><input className="h-11 rounded border px-3" placeholder="Filter by language"/></div>
    <div className="grid gap-4 md:grid-cols-2">{filtered.map(v => <Card className="p-4" key={v.name}><h3 className="font-semibold">{v.name}</h3><div className="mt-2 flex flex-wrap gap-2">{v.specializations.map((s:string)=><Badge key={s}>{s}</Badge>)}{v.regions.map((r:string)=><Badge variant="outline" key={r}>{r}</Badge>)}</div><a href={v.website} target="_blank" className="mt-3 block text-sm text-[#15803D]">{v.website}</a><Button className="mt-3 h-11 bg-[#15803D]" onClick={()=>setSelected(v)}>Request Quote</Button></Card>)}</div>
    {selected && <div className="fixed inset-0 z-50 bg-black/40 p-4"><Card className="mx-auto mt-16 max-w-lg p-5"><h3 className="font-semibold">RFQ to {selected.name}</h3><textarea className="mt-3 h-28 w-full rounded border p-2" value={message} onChange={e=>setMessage(e.target.value)}/><div className="mt-3 flex gap-2"><Button variant="outline" onClick={()=>setSelected(null)}>Cancel</Button><Button className="bg-[#15803D]" onClick={async()=>{await fetch(`/api/navigator/projects/${id}/rfq`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('session_id') || ''}`},body:JSON.stringify({vvb:selected,message,userEmail:localStorage.getItem('user_email')||''})}); setSelected(null);}}>Submit RFQ</Button></div></Card></div>}
  </NavigatorLayout>;
}
