import { useEffect, useState } from "react";
import { Link } from "wouter";
import { NavigatorLayout } from "@/components/navigator/NavigatorLayout";
import { Card } from "@/components/ui/card";

export default function NavigatorTracker({ params }: any) {
  const id = params.id;
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch(`/api/navigator/projects/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('session_id') || ''}` } }).then(r=>r.json()).then(setData); }, [id]);
  const score = data?.project?.readiness_score || 0;
  const completed = (data?.documents || []).filter((d:any)=>['uploaded','approved'].includes(d.status)).length;
  return <NavigatorLayout>
    <Card className="mb-4 p-5"><h1 className="text-2xl font-bold">{data?.project?.project_name || 'Project Tracker'}</h1><p className="text-sm text-[#475569]">Readiness: {score} · Status: {data?.project?.registration_status || 'intake'}</p></Card>
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4"><h3 className="font-semibold">Timeline</h3><p className="text-sm">Current milestone: Validation and VVB engagement.</p></Card>
      <Card className="p-4"><h3 className="font-semibold">Document Status</h3><p className="text-sm">{completed}/{(data?.documents || []).length} complete · <Link href={`/navigator/project/${id}/documents`} className="text-[#15803D]">View All Documents</Link></p></Card>
      <Card className="p-4"><h3 className="font-semibold">Red Flags</h3><p className="text-sm">Review unresolved AI flags in dashboard.</p></Card>
      <Card className="p-4"><h3 className="font-semibold">Next Actions</h3><label className="block text-sm"><input type="checkbox"/> Engage 3 shortlisted VVBs.</label></Card>
    </div>
    {score >= 85 && <Card className="mt-4 border-[#15803D] p-5"><h3 className="font-semibold">Ready to Trade?</h3><p className="text-sm">Your project is approaching registry-ready status.</p><a href="/x" className="text-[#15803D]">Go to Exchange →</a></Card>}
  </NavigatorLayout>;
}
