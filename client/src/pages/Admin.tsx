import { useState, useEffect } from "react";
import { useLocation } from "wouter";

const C = {
  ink: '#060810', ink2: '#0d1220', ink3: '#141e30',
  gold: '#d4a843', gold2: '#f0c96a', goldfaint: 'rgba(212,168,67,0.12)',
  goldborder: 'rgba(212,168,67,0.22)', cream: '#f2ead8',
  cream2: 'rgba(242,234,216,0.7)', cream3: 'rgba(242,234,216,0.35)',
  green: '#22c55e', red: '#ef4444', orange: '#f97316',
};
const F = { mono: "'JetBrains Mono', monospace", syne: "'Syne', sans-serif", playfair: "'Playfair Display', serif" };

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: `${color}22`, border: `1px solid ${color}55`, color, fontFamily: F.mono, fontSize: 10, padding: '2px 8px', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
      {label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ fontFamily: F.syne, fontSize: 16, fontWeight: 700, color: C.gold, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16, borderBottom: `1px solid ${C.goldborder}`, paddingBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function Admin() {
  const [location] = useLocation();
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const urlKey = params.get('key') || '';

  const [adminKey, setAdminKey] = useState(urlKey);
  const [keyInput, setKeyInput] = useState('');
  const [authed, setAuthed] = useState(!!urlKey);

  const [pendingListings, setPendingListings] = useState<any[]>([]);
  const [webhookFailures, setWebhookFailures] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([]);

  function toast(msg: string, ok = true) {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, ok }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [lRes, wRes, hRes] = await Promise.all([
        fetch(`/api/admin/listings/pending?admin_key=${encodeURIComponent(adminKey)}`),
        fetch(`/api/admin/webhooks/failures?admin_key=${encodeURIComponent(adminKey)}`),
        fetch(`/api/admin/health-check?admin_key=${encodeURIComponent(adminKey)}`),
      ]);
      if (lRes.status === 403 || wRes.status === 403 || hRes.status === 403) {
        setAuthed(false);
        toast('Invalid admin key', false);
        return;
      }
      setPendingListings(await lRes.json());
      setWebhookFailures(await wRes.json());
      setHealthData(await hRes.json());
    } catch (e: any) {
      toast('Load failed: ' + e.message, false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (authed && adminKey) loadAll(); }, [authed]);

  async function approveListing(id: string) {
    try {
      const r = await fetch(`/api/admin/listings/${id}/approve?admin_key=${encodeURIComponent(adminKey)}`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Approve failed', false); return; }
      toast('Listing approved and published to marketplace');
      setPendingListings(prev => prev.filter(l => l.id !== id));
    } catch (e: any) { toast(e.message, false); }
  }

  async function rejectListing(id: string) {
    const reason = rejectReasons[id] || '';
    try {
      const r = await fetch(`/api/admin/listings/${id}/reject?admin_key=${encodeURIComponent(adminKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Reject failed', false); return; }
      toast('Listing rejected — seller notified');
      setPendingListings(prev => prev.filter(l => l.id !== id));
    } catch (e: any) { toast(e.message, false); }
  }

  async function retryWebhook(id: string) {
    try {
      const r = await fetch(`/api/admin/webhooks/retry/${id}?admin_key=${encodeURIComponent(adminKey)}`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Retry failed', false); return; }
      toast(`Retry complete: ${d.action}`);
      setWebhookFailures(prev => prev.filter(f => f.id !== id));
    } catch (e: any) { toast(e.message, false); }
  }

  const cardStyle: React.CSSProperties = { background: C.ink2, border: `1px solid ${C.goldborder}`, padding: 20, marginBottom: 16 };
  const labelStyle: React.CSSProperties = { fontFamily: F.mono, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.cream3, display: 'block', marginBottom: 4 };
  const valStyle: React.CSSProperties = { fontFamily: F.mono, fontSize: 12, color: C.cream, marginBottom: 12 };
  const btnGreen: React.CSSProperties = { background: `${C.green}22`, border: `1px solid ${C.green}55`, color: C.green, fontFamily: F.mono, fontSize: 11, padding: '7px 18px', cursor: 'pointer', letterSpacing: '0.08em' };
  const btnRed: React.CSSProperties = { background: `${C.red}22`, border: `1px solid ${C.red}55`, color: C.red, fontFamily: F.mono, fontSize: 11, padding: '7px 18px', cursor: 'pointer', letterSpacing: '0.08em' };
  const btnGold: React.CSSProperties = { background: C.goldfaint, border: `1px solid ${C.goldborder}`, color: C.gold, fontFamily: F.mono, fontSize: 11, padding: '7px 18px', cursor: 'pointer', letterSpacing: '0.08em' };

  if (!authed) {
    return (
      <div style={{ background: C.ink, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: C.ink2, border: `1px solid ${C.goldborder}`, padding: 40, maxWidth: 400, width: '100%' }}>
          <div style={{ fontFamily: F.playfair, fontSize: 24, color: C.gold, marginBottom: 8 }}>UAIU Admin</div>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3, marginBottom: 24 }}>Enter your admin key to continue</div>
          <input
            data-testid="input-admin-key"
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setAdminKey(keyInput); setAuthed(true); } }}
            placeholder="Admin key..."
            style={{ width: '100%', background: C.ink3, border: `1px solid ${C.goldborder}`, color: C.cream, fontFamily: F.mono, fontSize: 13, padding: '12px 14px', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
          />
          <button
            data-testid="button-admin-login"
            onClick={() => { setAdminKey(keyInput); setAuthed(true); }}
            style={{ ...btnGold, width: '100%', padding: '12px 0' }}
          >
            Enter Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.ink, minHeight: '100vh', fontFamily: F.mono, color: C.cream }}>
      {/* Toast notifications */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: t.ok ? `${C.green}22` : `${C.red}22`, border: `1px solid ${t.ok ? C.green : C.red}55`, color: t.ok ? C.green : C.red, padding: '10px 16px', fontFamily: F.mono, fontSize: 12, maxWidth: 320 }}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ background: C.ink2, borderBottom: `1px solid ${C.goldborder}`, padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
          <span style={{ fontFamily: F.playfair, fontSize: 20, color: C.gold }}>UAIU</span>
          <span style={{ fontFamily: F.syne, fontSize: 13, color: C.cream3, marginLeft: 12, letterSpacing: '0.12em' }}>ADMIN DASHBOARD</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {loading && <span style={{ fontSize: 11, color: C.cream3 }}>Loading...</span>}
          <button data-testid="button-admin-refresh" onClick={loadAll} style={btnGold}>Refresh</button>
          <a href="/x" style={{ ...btnGold, textDecoration: 'none', display: 'inline-block' }}>Back to Exchange</a>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>

        {/* Section 1: Pending Listings */}
        <Section title={`Pending Listings (${pendingListings.length})`}>
          {pendingListings.length === 0 ? (
            <div style={{ color: C.cream3, fontSize: 12, padding: '20px 0' }}>No listings pending review.</div>
          ) : (
            pendingListings.map(l => (
              <div key={l.id} data-testid={`card-listing-${l.id}`} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F.playfair, fontSize: 16, color: C.cream, marginBottom: 8 }}>
                      {l.orgName || l.org_name || 'Unknown Org'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                      <Badge label={l.creditType || l.credit_type || 'Credit'} color={C.gold} />
                      <Badge label={l.standard || '—'} color={C.cream2} />
                      <Badge label={`${Number(l.annualVolume || l.annual_volume || 0).toLocaleString()} t/yr`} color={C.green} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '4px 24px' }}>
                      {[
                        ['Email', l.email],
                        ['Asking Price', `€${l.askingPricePerTonne || l.asking_price_per_tonne || '—'}/t`],
                        ['Origin', l.projectOrigin || l.project_origin || '—'],
                        ['Registry Serial', l.registrySerial || l.registry_serial || '—'],
                        ['Submitted', l.createdAt ? new Date(l.createdAt).toLocaleDateString() : '—'],
                        ['Status', l.status || 'pending'],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <span style={labelStyle}>{k}</span>
                          <span style={valStyle}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
                    <button data-testid={`button-approve-${l.id}`} onClick={() => approveListing(l.id)} style={btnGreen}>
                      Approve & Publish
                    </button>
                    <input
                      data-testid={`input-reject-reason-${l.id}`}
                      placeholder="Rejection reason (optional)..."
                      value={rejectReasons[l.id] || ''}
                      onChange={e => setRejectReasons(prev => ({ ...prev, [l.id]: e.target.value }))}
                      style={{ background: C.ink3, border: `1px solid ${C.goldborder}`, color: C.cream, fontFamily: F.mono, fontSize: 10, padding: '6px 10px', outline: 'none' }}
                    />
                    <button data-testid={`button-reject-${l.id}`} onClick={() => rejectListing(l.id)} style={btnRed}>
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </Section>

        {/* Section 2: Webhook Dead-Letter Queue */}
        <Section title={`Failed Webhooks — Dead-Letter Queue (${webhookFailures.length})`}>
          {webhookFailures.length === 0 ? (
            <div style={{ color: C.cream3, fontSize: 12, padding: '20px 0' }}>No unresolved webhook failures.</div>
          ) : (
            webhookFailures.map(f => (
              <div key={f.id} data-testid={`card-webhook-${f.id}`} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <Badge label={f.eventType || f.event_type || '—'} color={C.orange} />
                      <Badge label={`Retries: ${f.retryCount ?? f.retry_count ?? 0}`} color={C.cream3} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px 24px' }}>
                      {[
                        ['Trade ID', f.tradeId || f.trade_id || '—'],
                        ['Payment Intent', (f.paymentIntentId || f.payment_intent_id || '—').slice(0, 28)],
                        ['Event ID', (f.eventId || f.event_id || '—').slice(0, 28)],
                        ['Last Attempted', f.lastAttemptedAt || f.last_attempted_at ? new Date(f.lastAttemptedAt || f.last_attempted_at).toLocaleString() : '—'],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <span style={labelStyle}>{k}</span>
                          <span style={valStyle}>{v}</span>
                        </div>
                      ))}
                    </div>
                    {(f.errorMessage || f.error_message) && (
                      <div style={{ background: `${C.red}11`, border: `1px solid ${C.red}33`, padding: '8px 12px', marginTop: 10 }}>
                        <span style={{ ...labelStyle, color: C.red, marginBottom: 4 }}>Error</span>
                        <span style={{ fontFamily: F.mono, fontSize: 10, color: `${C.red}cc` }}>{(f.errorMessage || f.error_message || '').slice(0, 200)}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <button data-testid={`button-retry-${f.id}`} onClick={() => retryWebhook(f.id)} style={btnGold}>
                      Retry
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </Section>

        {/* Section 3: System Health Check */}
        <Section title="System Health">
          {!healthData ? (
            <div style={{ color: C.cream3, fontSize: 12, padding: '20px 0' }}>Loading health data...</div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Badge
                  label={healthData.ready ? 'ALL SYSTEMS OK' : 'DEGRADED'}
                  color={healthData.ready ? C.green : C.red}
                />
                <span style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3 }}>{healthData.timestamp}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {Object.entries(healthData.systems || {}).map(([key, val]: [string, any]) => {
                  const status = typeof val === 'string' ? val : val?.status || '—';
                  const ok = status.startsWith('OK');
                  const warn = status.startsWith('WARN');
                  const color = ok ? C.green : warn ? C.orange : C.red;
                  return (
                    <div key={key} data-testid={`health-${key}`} style={{ background: C.ink3, border: `1px solid ${C.goldborder}`, padding: '12px 16px' }}>
                      <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.15em', color: C.cream3, textTransform: 'uppercase', marginBottom: 6 }}>{key.replace(/_/g, ' ')}</div>
                      <div style={{ color, fontFamily: F.mono, fontSize: 11, marginBottom: 4 }}>{status}</div>
                      {typeof val === 'object' && Object.entries(val).filter(([k]) => k !== 'status').map(([k, v]) => (
                        <div key={k} style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginTop: 2 }}>
                          {k}: {String(v)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              {healthData.next_steps && (
                <div style={{ background: C.goldfaint, border: `1px solid ${C.goldborder}`, padding: '12px 16px', marginTop: 16, fontFamily: F.mono, fontSize: 12, color: C.cream }}>
                  {healthData.next_steps}
                </div>
              )}
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}
