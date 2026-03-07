import { useEffect, useMemo, useState } from "react";
import { NavigatorLayout } from "@/components/navigator/NavigatorLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NavigatorDocuments({ params }: any) {
  const id = params.id;
  const [docs, setDocs] = useState<any[]>([]);
  useEffect(() => { fetch(`/api/navigator/projects/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('session_id') || ''}` } }).then(r=>r.json()).then(d=>setDocs(d.documents||[])); }, [id]);
  const grouped = useMemo(() => docs.reduce((a: any, d: any) => ((a[d.document_type] = [...(a[d.document_type] || []), d]), a), {}), [docs]);
  const complete = docs.filter(d => d.status === 'approved' || d.status === 'uploaded').length;
  return <NavigatorLayout>
    <Card className="mb-4 p-4"><p className="text-sm">{complete} of {docs.length} documents complete</p><div className="mt-2 h-2 overflow-hidden rounded bg-[#D1FAE5]"><div className="h-full bg-[#15803D]" style={{width:`${docs.length? (complete/docs.length)*100:0}%`}}/></div></Card>
    <div className="space-y-4">{Object.keys(grouped).map(cat => <Card className="p-4" key={cat}><h3 className="mb-3 font-semibold">{cat}</h3><div className="space-y-2">{grouped[cat].map((d:any)=><div key={d.document_name} className="rounded border p-3"><p className="font-medium">{d.document_name}</p><p className="text-xs">Status: <span className="rounded bg-[#ECFDF5] px-2">{d.status}</span></p><textarea className="mt-2 w-full rounded border p-2 text-sm" placeholder="Notes" defaultValue={d.notes||''} onBlur={async e=>{await fetch(`/api/navigator/projects/${id}/documents`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('session_id')||''}`},body:JSON.stringify({...d,notes:e.target.value})})}}/><div className="mt-2 flex gap-2"><Button className="h-10" variant="outline" onClick={()=>window.open('https://verra.org','_blank')}>Get Template</Button><Button className="h-10 bg-[#15803D]" onClick={async()=>{await fetch(`/api/navigator/projects/${id}/documents`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('session_id')||''}`},body:JSON.stringify({...d,status:'uploaded'})}); setDocs(p=>p.map(x=>x.document_name===d.document_name?{...x,status:'uploaded'}:x));}}>Mark Uploaded</Button></div></div>)}</div></Card>)}</div>
  </NavigatorLayout>;
}
