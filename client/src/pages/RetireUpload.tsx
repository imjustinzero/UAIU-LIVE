import { useState } from "react";
import { useLocation } from "wouter";

const C = {
  ink: '#060810',
  ink2: '#0d1220',
  gold: '#d4a843',
  goldborder: 'rgba(212,168,67,0.22)',
  cream: '#f2ead8',
  cream3: 'rgba(242,234,216,0.35)',
  green: '#22c55e',
  red: '#ef4444',
};

export default function RetireUpload() {
  const [location] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [ok, setOk] = useState<boolean | null>(null);

  const parts = location.split("?")[0].split("/");
  const tradeId = decodeURIComponent(parts[2] || "");
  const query = new URLSearchParams(location.split("?")[1] || "");
  const token = query.get("token") || "";

  const submit = async () => {
    if (!tradeId || !token || !file) {
      setOk(false);
      setMessage("Missing trade ID, token, or certificate file.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("token", token);
      fd.append("certificate", file);
      const res = await fetch(`/api/exchange/retire-upload/${encodeURIComponent(tradeId)}`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOk(true);
        setMessage(data?.message || "Certificate uploaded and retirement confirmed.");
      } else {
        setOk(false);
        setMessage(data?.error || "Upload failed.");
      }
    } catch {
      setOk(false);
      setMessage("Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.ink, color: C.cream, display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 640, background: C.ink2, border: `1px solid ${C.goldborder}`, padding: 28 }}>
        <h1 style={{ margin: 0, marginBottom: 8, color: C.gold, fontSize: 34, fontFamily: 'Georgia, serif' }}>Retirement Certificate Upload</h1>
        <div style={{ fontSize: 12, color: C.cream3, marginBottom: 20 }}>Trade ID: {tradeId || '—'}</div>
        <p style={{ marginTop: 0, lineHeight: 1.6 }}>Upload the official retirement certificate (PDF, CSV, DOCX, PNG, JPG). This secure link is one-time use.</p>
        <input
          type="file"
          accept=".pdf,.csv,.docx,.png,.jpg,.jpeg"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          data-testid="input-retirement-certificate"
          style={{ width: '100%', marginBottom: 16, color: C.cream }}
        />
        <button
          onClick={submit}
          disabled={submitting || !file || !token || !tradeId}
          data-testid="button-upload-certificate"
          style={{
            width: '100%',
            padding: '12px 16px',
            background: C.gold,
            color: C.ink,
            border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting || !file || !token || !tradeId ? 0.6 : 1,
            fontWeight: 700,
          }}
        >
          {submitting ? 'Uploading…' : 'Upload Certificate'}
        </button>
        {message && (
          <div data-testid="status-upload" style={{ marginTop: 14, color: ok ? C.green : C.red, fontSize: 13 }}>{message}</div>
        )}
      </div>
    </div>
  );
}
