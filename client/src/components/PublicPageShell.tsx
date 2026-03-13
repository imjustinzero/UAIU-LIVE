import { Link } from "wouter";
import { useSEO } from "@/lib/seo";
import { ArrowLeft } from "lucide-react";

interface PublicPageShellProps {
  title: string;
  description: string;
  path: string;
  children: React.ReactNode;
}

const C = {
  bg: "#090d17",
  header: "#0a0e1a",
  border: "#1e293b",
  gold: "#facc15",
  text: "#f2ead8",
  muted: "#94a3b8",
  card: "#0f1623",
};

export default function PublicPageShell({ title, description, path, children }: PublicPageShellProps) {
  useSEO({ title, description, path });

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        .pps-header { background: ${C.header}; border-bottom: 1px solid ${C.border}; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; }
        @media (max-width: 480px) { .pps-header { padding: 12px 16px; } }
        .pps-content { max-width: 1100px; margin: 0 auto; padding: 32px 20px; }
        @media (max-width: 480px) { .pps-content { padding: 24px 16px; } }
        .pps-footer { border-top: 1px solid ${C.border}; margin-top: 60px; padding: 24px 20px; text-align: center; }
        .pps-footer a { color: ${C.muted}; text-decoration: none; font-size: 12px; margin: 0 10px; }
        .pps-footer a:hover { color: ${C.gold}; }
      `}</style>

      {/* Header */}
      <div className="pps-header">
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: C.gold, fontWeight: 700, letterSpacing: "0.04em" }}>
          UAIU.LIVE/X
        </div>
        <Link href="/x" style={{ color: C.muted, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
          <ArrowLeft size={13} /> Back to Exchange
        </Link>
      </div>

      {/* Content */}
      <div className="pps-content">
        {children}
      </div>

      {/* Footer */}
      <div className="pps-footer">
        <div style={{ color: C.muted, fontSize: 11, marginBottom: 10 }}>UAIU.LIVE/X · Institutional Carbon Procurement Platform</div>
        <div>
          <Link href="/x" style={{ color: C.muted, textDecoration: "none", fontSize: 12, margin: "0 10px" }}>Exchange</Link>
          <Link href="/blog" style={{ color: C.muted, textDecoration: "none", fontSize: 12, margin: "0 10px" }}>Blog</Link>
          <Link href="/security" style={{ color: C.muted, textDecoration: "none", fontSize: 12, margin: "0 10px" }}>Security</Link>
          <Link href="/status" style={{ color: C.muted, textDecoration: "none", fontSize: 12, margin: "0 10px" }}>Status</Link>
          <Link href="/legal" style={{ color: C.muted, textDecoration: "none", fontSize: 12, margin: "0 10px" }}>Legal</Link>
        </div>
      </div>
    </div>
  );
}
