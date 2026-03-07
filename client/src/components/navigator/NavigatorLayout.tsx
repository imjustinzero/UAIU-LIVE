import { Compass, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

const links = [
  { href: "/navigator", label: "Home" },
  { href: "/navigator/projects", label: "My Projects" },
  { href: "/x", label: "Exchange" },
];

export function NavigatorLayout({ children }: { children: React.ReactNode }) {
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#ECFDF5] text-[#0B0E11]">
      <header className="sticky top-0 z-50 border-b border-[#E2E8F0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/navigator" className="flex items-center gap-2 font-semibold"><Compass className="h-5 w-5 text-[#15803D]"/>Navigator</Link>
          <nav className="hidden gap-5 md:flex">{links.map(l => <Link key={l.href} href={l.href} className={`text-sm ${loc===l.href?'text-[#15803D] border-b-2 border-[#15803D]':'text-[#475569]'}`}>{l.label}</Link>)}</nav>
          <button className="md:hidden" onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button>
        </div>
        {open && <div className="space-y-2 border-t bg-white p-4 md:hidden">{links.map(l => <Link key={l.href} href={l.href} className="block text-base" onClick={() => setOpen(false)}>{l.label}</Link>)}</div>}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="border-t border-[#E2E8F0] bg-white px-4 py-6 text-sm text-[#475569]">
        <div className="mx-auto max-w-6xl">UAIU Navigator is a guidance and preparation tool. It does not constitute legal, financial, or regulatory advice. All Verra VCS registration decisions and submissions must be made by qualified project developers and approved VVBs in accordance with official Verra program rules. UAIU Holdings Corp is not affiliated with Verra.</div>
      </footer>
    </div>
  );
}
