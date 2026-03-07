import { useEffect, useState } from "react";
import { Link } from "wouter";
import { NavigatorLayout } from "@/components/navigator/NavigatorLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NavigatorProjects() {
  const [projects, setProjects] = useState<any[]>([]);
  useEffect(() => { fetch('/api/navigator/projects', { headers: { Authorization: `Bearer ${localStorage.getItem('session_id') || ''}` } }).then(r=>r.json()).then(setProjects); }, []);
  return <NavigatorLayout>
    <h1 className="mb-4 text-2xl font-bold">My Projects</h1>
    {!projects.length ? <Card className="p-8 text-center"><p>No projects yet.</p><Link href="/navigator/intake"><Button className="mt-3 h-11 bg-[#15803D]">Start your first project →</Button></Link></Card> :
    <div className="grid gap-4 md:grid-cols-2">{projects.map(p => <Card key={p.id} className="p-4"><h3 className="font-semibold">{p.project_name}</h3><p className="text-sm text-[#475569]">{p.project_type} · {p.country}</p><p className="mt-2 text-sm">Readiness: {p.readiness_score || 0}</p><Link href={`/navigator/project/${p.id}`} className="mt-2 inline-block text-[#15803D]">Open Project</Link></Card>)}</div>}
  </NavigatorLayout>;
}
