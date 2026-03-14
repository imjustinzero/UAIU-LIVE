import { Compass } from "lucide-react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NavigatorLayout } from "@/components/navigator/NavigatorLayout";
import { useSEO } from "@/lib/seo";

export default function NavigatorLanding() {
  useSEO({
    title: 'Carbon Credit Registration Navigator',
    description: 'Free AI-guided Verra VCS carbon credit registration tool. Step-by-step guidance from raw land to issued credits. Built for project developers, landowners, and sovereign carbon offices.',
    path: '/navigator',
  });
  return <NavigatorLayout>
    <section className="rounded-2xl bg-white p-8 shadow-sm">
      <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#D1FAE5] px-3 py-1 text-sm text-[#0D4F2F]"><Compass className="h-4 w-4"/> UAIU Navigator</p>
      <h1 className="text-3xl font-bold md:text-5xl">Register carbon credits on Verra in minutes — no compliance team needed</h1>
      <p className="mt-3 max-w-3xl text-[#475569]">A guided workflow for project developers and operators to collect inputs, generate documents, and track readiness with fewer compliance bottlenecks.</p>
      <div className="mt-6 grid gap-3 md:grid-cols-4">{["16 Verra Methodologies covered","2-4 Years typical timeline","7 Steps to registration","Free to use Navigator"].map((s)=><div className="rounded-lg border border-[#E2E8F0] bg-[#ECFDF5] p-3 text-sm" key={s}>{s}</div>)}</div>
      <div className="mt-6 grid gap-3 md:grid-cols-3"><div className="rounded-lg border border-[#E2E8F0] p-3 text-sm">1. Enter project intake details</div><div className="rounded-lg border border-[#E2E8F0] p-3 text-sm">2. Generate required registration documents</div><div className="rounded-lg border border-[#E2E8F0] p-3 text-sm">3. Track VVB + registry progress</div></div><Link href="/navigator/intake"><Button className="mt-6 h-12 bg-[#15803D] text-white hover:bg-[#0D4F2F]">Start Registration</Button></Link>
    </section>
    <section className="mt-6 grid gap-4 md:grid-cols-3">{["Landowners & Forest Owners","Sovereign Nation Carbon Offices","Carbon Consultants & Brokers"].map((t)=><Card key={t} className="p-6"><h3 className="font-semibold">{t}</h3></Card>)}</section>
  </NavigatorLayout>;
}
