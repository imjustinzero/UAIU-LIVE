import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { NavigatorLayout } from "@/components/navigator/NavigatorLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { countries, methodologies, projectTypes } from "./utils";

const key = "navigator-intake";

export default function NavigatorIntake() {
  const [, nav] = useLocation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<any>(() => JSON.parse(localStorage.getItem(key) || "{}"));
  const progress = useMemo(() => (step / 6) * 100, [step]);
  const set = (k: string, v: any) => {
    const next = { ...form, [k]: v };
    setForm(next);
    localStorage.setItem(key, JSON.stringify(next));
  };
  const estimate = form.hectares && form.forestType ? Math.round(Number(form.hectares) * ({ tropical: 12, temperate: 7, boreal: 4 } as any)[form.forestType] * ((form.canopy || 50) / 100)) : undefined;

  async function submit() {
    const created = await fetch('/api/navigator/projects', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('session_id') || ''}` }, body: JSON.stringify({ ...form, estimated_tonnes: form.estimated_tonnes || estimate }) }).then(r => r.json());
    localStorage.removeItem(key);
    nav(`/navigator/project/${created.id}`);
  }

  return <NavigatorLayout>
    <div className="mb-4 h-2 overflow-hidden rounded bg-[#D1FAE5]"><div className="h-full bg-[#15803D]" style={{width:`${progress}%`}}/></div>
    <p className="mb-4 text-sm text-[#475569]">Step {step} of 6</p>
    <div className="space-y-4 rounded-xl bg-white p-5">
      {step===1 && <><Label>Project name</Label><Input className="h-11 text-base" value={form.project_name||''} onChange={e=>set('project_name',e.target.value)}/><Label>Project type</Label><div className="grid gap-2 md:grid-cols-2">{projectTypes.map((p)=><button key={p} onClick={()=>set('project_type',p)} className={`h-11 rounded border text-left px-3 ${form.project_type===p?'border-[#15803D] bg-[#ECFDF5]':''}`}>{p}</button>)}</div><Label>Country</Label><select className="h-11 w-full rounded border px-3 text-base" value={form.country||''} onChange={e=>set('country',e.target.value)}>{countries.map(c=><option key={c}>{c}</option>)}</select><Label>Project description</Label><Textarea value={form.description||''} onChange={e=>set('description',e.target.value)}/></>}
      {step===2 && <><Label>Land ownership type</Label><div className="grid gap-2">{["Private individual/company","Government / public land","Indigenous / community owned","Mixed ownership"].map((t)=><button key={t} onClick={()=>set('land_ownership',t)} className={`h-11 rounded border px-3 text-left ${form.land_ownership===t?'border-[#15803D] bg-[#ECFDF5]':''}`}>{t}</button>)}</div><Label>Approximate hectares</Label><Input type="number" className="h-11 text-base" value={form.hectares||''} onChange={e=>set('hectares',e.target.value)}/><Label>Estimated annual tonnes</Label><Input type="number" className="h-11 text-base" value={form.estimated_tonnes||''} onChange={e=>set('estimated_tonnes',e.target.value)} placeholder="Not sure? Leave blank"/>{!form.estimated_tonnes&&<><Label>Forest type</Label><select className="h-11 w-full rounded border px-3" value={form.forestType||'tropical'} onChange={e=>set('forestType',e.target.value)}><option value='tropical'>tropical</option><option value='temperate'>temperate</option><option value='boreal'>boreal</option></select><Label>Canopy cover %: {form.canopy||50}</Label><input type="range" min="10" max="100" value={form.canopy||50} onChange={e=>set('canopy',e.target.value)} className="w-full"/><p className="text-sm">Estimated tonnes: <b>{estimate||0}</b></p></>}</>}
      {step===3 && <div className="grid gap-3">{[['baseline_done','Has any baseline assessment been done?'],['land_tenure_available','Is land tenure documentation available?'],['permits','Any existing environmental permits?'],['vvb_engaged','Has a VVB been engaged yet?'],['sold_forward','Has any carbon been sold or forward-contracted already?']].map(([k,q])=><div key={k}><Label>{q}</Label><select className="h-11 w-full rounded border px-3" value={form[k]||'no'} onChange={e=>set(k,e.target.value)}><option>yes</option><option>no</option><option>partial</option></select></div>)}<Label>Estimated project start date</Label><Input type='date' className="h-11" value={form.start_date||''} onChange={e=>set('start_date',e.target.value)}/></div>}
      {step===4 && <><p className="text-sm text-[#475569]">Suggested methodologies</p><div className="grid gap-3 md:grid-cols-2">{(methodologies[form.project_type as keyof typeof methodologies]||['VM0048']).map(m=><button className={`rounded border p-3 text-left ${form.methodology_selected===m?'border-[#15803D] bg-[#ECFDF5]':''}`} onClick={()=>set('methodology_selected',m)} key={m}><h4 className="font-semibold">{m}</h4><p className="text-sm text-[#475569]">Estimated complexity: Medium · Typical volume: 50k–500k</p><a href="https://verra.org" target="_blank" className="text-xs text-[#15803D]">Official Verra PDF</a></button>)}</div></>}
      {step===5 && <div className="grid gap-3 md:grid-cols-2"><div><Label>Full name</Label><Input className="h-11" value={form.full_name||''} onChange={e=>set('full_name',e.target.value)}/></div><div><Label>Organization</Label><Input className="h-11" value={form.organization||''} onChange={e=>set('organization',e.target.value)}/></div><div><Label>Email</Label><Input type="email" className="h-11" value={form.email||''} onChange={e=>set('email',e.target.value)}/></div><div><Label>Country of registration</Label><Input className="h-11" value={form.registration_country||''} onChange={e=>set('registration_country',e.target.value)}/></div><div><Label>Role</Label><select className="h-11 w-full rounded border px-3" value={form.role||'Project Developer'} onChange={e=>set('role',e.target.value)}>{['Project Developer','Landowner','Consultant','Government Official','Other'].map(r=><option key={r}>{r}</option>)}</select></div></div>}
      {step===6 && <div className="space-y-2"><h3 className="font-semibold">Review & Submit</h3><pre className="overflow-auto rounded bg-[#ECFDF5] p-3 text-xs">{JSON.stringify(form, null, 2)}</pre><Button className="h-11 bg-[#15803D]" onClick={submit}>Generate My Registration Roadmap →</Button></div>}
      <div className="flex justify-between pt-4"> <Button variant="outline" className="h-11" disabled={step===1} onClick={()=>setStep(s=>s-1)}>Back</Button><Button className="h-11 bg-[#15803D]" disabled={step===6} onClick={()=>setStep(s=>s+1)}>Next</Button></div>
    </div>
  </NavigatorLayout>;
}
