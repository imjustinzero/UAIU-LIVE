import { useState, type CSSProperties } from "react";

interface DemoRequestModalProps {
  open: boolean;
  onClose: () => void;
}

const interests = [
  "Buying Credits",
  "Selling Credits",
  "Maritime Compliance",
  "API Integration",
  "Other",
] as const;

export default function DemoRequestModal({ open, onClose }: DemoRequestModalProps) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState<(typeof interests)[number]>("Buying Credits");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit() {
    setError("");
    if (!name || !company || !role || !email) {
      setError("Please complete all fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company, role, email, interest }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not submit request.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,16,0.8)", zIndex: 99999, display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 520, background: "#0d1220", border: "1px solid rgba(212,168,67,0.22)", padding: 24, color: "#f2ead8" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Request a Demo</h3>
          <button onClick={onClose} style={{ background: "transparent", color: "#f2ead8", border: "none", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>

        {success ? (
          <div style={{ color: "#86efac", fontSize: 14 }}>Thanks — we'll be in touch within 1 business day.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={inputStyle} />
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" style={inputStyle} />
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" style={inputStyle} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" style={inputStyle} />
            <select value={interest} onChange={(e) => setInterest(e.target.value as (typeof interests)[number])} style={inputStyle}>
              {interests.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            {error && <div style={{ color: "#fca5a5", fontSize: 12 }}>{error}</div>}
            <button onClick={handleSubmit} disabled={loading} style={{ background: "#d4a843", color: "#060810", border: "none", padding: "11px 14px", fontWeight: 700, cursor: "pointer" }}>
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  background: "#060810",
  border: "1px solid rgba(212,168,67,0.22)",
  color: "#f2ead8",
  padding: "10px 12px",
};
