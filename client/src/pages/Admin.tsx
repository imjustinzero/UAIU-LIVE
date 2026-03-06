import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { EnterpriseOpsDashboard } from "@/components/admin/EnterpriseOpsDashboard";
import { LaunchChecklist } from "@/components/admin/LaunchChecklist";
import { IncidentBanner } from "@/components/admin/IncidentBanner";
import { AutonomousMarketplaceAdmin } from "@/components/admin/AutonomousMarketplaceAdmin";
import { BackupAdmin } from "@/components/admin/BackupAdmin";

const C = {
  bg: '#05080f',
  surface: '#0d1a2e',
  surface2: '#111f35',
  border: '#1e3050',
  gold: '#d4a843',
  gold2: '#f0c060',
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  text: '#e2e8f0',
  muted: '#64748b',
};

const F = {
  mono: "'JetBrains Mono', monospace",
  syne: "'Syne', sans-serif",
  playfair: "'Playfair Display', serif"
};

function Badge({ label, variant = 'muted' }: { label: string; variant?: 'green' | 'red' | 'yellow' | 'blue' | 'muted' }) {
  const styles: Record<string, React.CSSProperties> = {
    green: { background: 'rgba(34,197,94,.15)', color: C.green, border: '1px solid rgba(34,197,94,.3)' },
    red: { background: 'rgba(239,68,68,.15)', color: C.red, border: '1px solid rgba(239,68,68,.3)' },
    yellow: { background: 'rgba(234,179,8,.15)', color: C.yellow, border: '1px solid rgba(234,179,8,.3)' },
    blue: { background: 'rgba(59,130,246,.15)', color: C.blue, border: '1px solid rgba(59,130,246,.3)' },
    muted: { background: 'rgba(100,116,139,.15)', color: C.muted, border: '1px solid rgba(100,116,139,.3)' },
  };

  return (
    <span style={{ 
      display: 'inline-block', 
      padding: '2px 8px', 
      borderRadius: '20px', 
      fontSize: '11px', 
      fontFamily: F.mono,
      fontWeight: 700, 
      letterSpacing: '.5px',
      ...styles[variant]
    }}>
      {label}
    </span>
  );
}

export default function Admin() {
  const [location, setLocation] = useLocation();
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const urlKey = params.get('key') || '';

  const [adminKey, setAdminKey] = useState(urlKey);
  const [keyInput, setKeyInput] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'listings' | 'webhooks' | 'health' | 'autonomy' | 'backup'>('listings');
  const [pendingListings, setPendingListings] = useState<any[]>([]);
  const [webhookFailures, setWebhookFailures] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [platformStatus, setPlatformStatus] = useState<{ status: 'ok' | 'degraded' | 'incident'; message: string }>({
    status: 'ok',
    message: 'All systems operational.',
  });
  
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Your listing did not meet our current marketplace requirements.');
  
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'ok' | 'err' }[]>([]);

  function toast(msg: string, type: 'ok' | 'err' = 'ok') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  function adminHeaders(key: string): Record<string, string> {
    return { 'X-Admin-Key': key };
  }

  async function validateAndUnlock(key: string) {
    if (!key) return;
    try {
      const r = await fetch(`/api/admin/health-check`, { headers: adminHeaders(key) });
      if (r.status === 403) throw new Error('Invalid admin key.');
      setAdminKey(key);
      setAuthed(true);
      setAuthError('');
    } catch (e: any) {
      setAuthError(e.message);
      setAdminKey('');
    }
  }

  useEffect(() => {
    if (urlKey) validateAndUnlock(urlKey);
  }, [urlKey]);

  async function loadData() {
    setLoading(true);
    try {
      const [lRes, wRes, hRes, sRes] = await Promise.all([
        fetch(`/api/admin/listings/pending`, { headers: adminHeaders(adminKey) }),
        fetch(`/api/admin/webhooks/failures`, { headers: adminHeaders(adminKey) }),
        fetch(`/api/admin/health-check`, { headers: adminHeaders(adminKey) }),
        fetch(`/api/status/public`),
      ]);
      if (lRes.ok) setPendingListings(await lRes.json());
      if (wRes.ok) setWebhookFailures(await wRes.json());
      if (hRes.ok) setHealthData(await hRes.json());
      if (sRes.ok) {
        const sd = await sRes.json();
        const s: 'ok' | 'degraded' | 'incident' =
          sd.status === 'operational' ? 'ok'
          : sd.status === 'maintenance' || sd.status === 'degraded' ? 'degraded'
          : 'incident';
        setPlatformStatus({ status: s, message: sd.message || 'Status updated.' });
      }
    } catch (e: any) {
      toast('Failed to load data', 'err');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authed) loadData();
  }, [authed]);

  async function approveListing(id: string) {
    try {
      const r = await fetch(`/api/admin/listings/${id}/approve`, { method: 'POST', headers: adminHeaders(adminKey) });
      if (!r.ok) throw new Error('Approve failed');
      toast('Listing approved and published');
      setPendingListings(prev => prev.filter(l => l.id !== id));
    } catch (e: any) { toast(e.message, 'err'); }
  }

  async function confirmReject() {
    if (!rejectId) return;
    try {
      const r = await fetch(`/api/admin/listings/${rejectId}/reject`, {
        method: 'POST',
        headers: { ...adminHeaders(adminKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!r.ok) throw new Error('Reject failed');
      toast('Listing rejected and seller notified');
      setPendingListings(prev => prev.filter(l => l.id !== rejectId));
      setShowRejectModal(false);
      setRejectId(null);
    } catch (e: any) { toast(e.message, 'err'); }
  }

  async function retryWebhook(id: string) {
    try {
      const r = await fetch(`/api/admin/webhooks/retry/${id}`, { method: 'POST', headers: adminHeaders(adminKey) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Retry failed');
      toast(`Retry complete: ${d.action}`);
      setWebhookFailures(prev => prev.filter(f => f.id !== id));
    } catch (e: any) { toast(e.message, 'err'); }
  }

  if (!authed) {
    return (
      <div id="pin-gate" style={{ position: 'fixed', inset: 0, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '48px 40px', width: '340px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '22px', color: C.gold, marginBottom: '6px', fontFamily: F.playfair }}>⚡ UAIU Admin</h1>
          <p style={{ fontSize: '13px', color: C.muted, marginBottom: '28px', fontFamily: F.syne }}>Enter your admin key to continue</p>
          <input
            data-testid="input-admin-key"
            type="password"
            placeholder="••••••••"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') validateAndUnlock(keyInput); }}
            style={{ width: '100%', padding: '12px 16px', background: '#0a1525', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, fontSize: '15px', letterSpacing: '4px', textAlign: 'center', outline: 'none' }}
          />
          <div style={{ color: C.red, fontSize: '12px', marginTop: '8px', minHeight: '18px', fontFamily: F.mono }}>{authError}</div>
          <button
            data-testid="button-admin-unlock"
            className="btn btn-gold"
            onClick={() => validateAndUnlock(keyInput)}
            style={{ width: '100%', marginTop: '18px', padding: '13px', background: C.gold, color: C.bg, border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            Unlock Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: C.bg, color: C.text }}>
      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '32px', width: '460px', maxWidth: 'calc(100vw - 40px)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', fontFamily: F.syne }}>Reject Listing</h3>
            <p style={{ fontSize: '13px', color: C.muted, marginBottom: '12px' }}>An email will be sent to the seller explaining the rejection.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (sent to seller)..."
              style={{ width: '100%', padding: '10px 12px', background: '#0a1525', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, fontSize: '13px', resize: 'vertical', minHeight: '90px', outline: 'none', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: '16px', justifyContent: 'flex-end' }}>
              <button data-testid="button-cancel-reject" onClick={() => setShowRejectModal(false)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
              <button data-testid="button-confirm-reject" onClick={confirmReject} style={{ background: C.red, color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Send Rejection</button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 10000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderLeft: `3px solid ${t.type === 'ok' ? C.green : C.red}`, borderRadius: '8px', padding: '12px 18px', fontSize: '13px', color: C.text, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            {t.msg}
          </div>
        ))}
      </div>

      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 style={{ fontSize: '18px', color: C.gold, letterSpacing: '.5px', fontFamily: F.playfair }}>⚡ UAIU Admin Dashboard</h1>
        <span style={{ fontSize: '12px', color: C.muted, marginLeft: 'auto', fontFamily: F.mono }}>Last updated: {new Date().toLocaleTimeString()}</span>
      </header>

      <main style={{ flex: 1, padding: '32px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', borderBottom: `1px solid ${C.border}` }}>
          {[
            { id: 'listings', label: 'Pending Listings', count: pendingListings.length },
            { id: 'webhooks', label: 'Webhook Failures', count: webhookFailures.length },
            { id: 'health', label: 'System Health', count: null },
            { id: 'autonomy', label: 'Autonomous Marketplace', count: null },
            { id: 'backup', label: 'Backup & DR', count: null }
          ].map(tab => (
            <button
              key={tab.id}
              data-testid={`button-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '10px 20px', fontSize: '13px', fontWeight: 600, border: 'none', background: 'transparent', 
                color: activeTab === tab.id ? C.gold : C.muted, cursor: 'pointer',
                borderBottom: `2px solid ${activeTab === tab.id ? C.gold : 'transparent'}`,
                marginBottom: '-1px', transition: 'color .2s, border-color .2s',
                fontFamily: F.syne
              }}
            >
              {tab.label}
              {tab.count !== null && (
                <span style={{ 
                  display: 'inline-block', marginLeft: '6px', padding: '1px 7px', 
                  background: activeTab === tab.id ? 'rgba(212,168,67,.2)' : C.border, 
                  borderRadius: '10px', fontSize: '11px', color: activeTab === tab.id ? C.gold : C.muted,
                  fontFamily: F.mono
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Panel 1: Listings */}
        {activeTab === 'listings' && (
          <div style={{ animation: 'fadeIn .3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.text, fontFamily: F.syne }}>Pending Seller Listings</h2>
                <p style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>New submissions saved as <code style={{ color: C.yellow }}>pending</code> — approve to publish, reject to email seller.</p>
              </div>
              <button data-testid="button-refresh-listings" onClick={loadData} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>↻ Refresh</button>
            </div>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}><div className="spinner" style={{ width: '20px', height: '20px', border: `2px solid ${C.border}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }}></div></div>
            ) : pendingListings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted, fontSize: '14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px' }}>No listings pending review.</div>
            ) : (
              pendingListings.map(l => (
                <div key={l.id} data-testid={`card-listing-${l.id}`} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '14px' }}>
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '4px', fontFamily: F.syne }}>{l.orgName || l.org_name}</div>
                      <div style={{ fontSize: '12px', color: C.muted }}>{l.creditType || l.credit_type} • {l.standard}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button data-testid={`button-approve-${l.id}`} onClick={() => approveListing(l.id)} style={{ background: C.green, color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Approve</button>
                      <button data-testid={`button-reject-${l.id}`} onClick={() => { setRejectId(l.id); setShowRejectModal(true); }} style={{ background: C.red, color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Reject</button>
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                    <div className="kv"><span style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase' }}>Email</span><span style={{ fontSize: '13px', color: C.text, fontFamily: F.mono }}>{l.email}</span></div>
                    <div className="kv"><span style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase' }}>Origin</span><span style={{ fontSize: '13px', color: C.text, fontFamily: F.mono }}>{l.projectOrigin || l.project_origin}</span></div>
                    <div className="kv"><span style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase' }}>Volume</span><span style={{ fontSize: '13px', color: C.text, fontFamily: F.mono }}>{l.annualVolume || l.annual_volume} t/yr</span></div>
                    <div className="kv"><span style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase' }}>Price</span><span style={{ fontSize: '13px', color: C.text, fontFamily: F.mono }}>€{l.askingPricePerTonne || l.asking_price_per_tonne}/t</span></div>
                    <div className="kv"><span style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase' }}>Serial</span><span style={{ fontSize: '13px', color: C.text, fontFamily: F.mono }}>{l.registrySerial || l.registry_serial}</span></div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Panel 2: Webhooks */}
        {activeTab === 'webhooks' && (
          <div style={{ animation: 'fadeIn .3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.text, fontFamily: F.syne }}>Webhook Dead-Letter Queue</h2>
                <p style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>Unhandled webhook exceptions. Retry re-attempts Stripe capture.</p>
              </div>
              <button data-testid="button-refresh-webhooks" onClick={loadData} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>↻ Refresh</button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}><div className="spinner" style={{ width: '20px', height: '20px', border: `2px solid ${C.border}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }}></div></div>
            ) : webhookFailures.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted, fontSize: '14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px' }}>No webhook failures recorded.</div>
            ) : (
              webhookFailures.map(f => (
                <div key={f.id} data-testid={`card-webhook-${f.id}`} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '14px' }}>
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px', fontFamily: F.mono, color: C.gold }}>{f.eventType || f.event_type}</div>
                      <div style={{ fontSize: '12px', color: C.muted }}>Trade ID: {f.tradeId || f.trade_id || '—'}</div>
                    </div>
                    <button data-testid={`button-retry-webhook-${f.id}`} onClick={() => retryWebhook(f.id)} style={{ background: C.gold, color: C.bg, border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Retry</button>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    <div className="kv"><span style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase' }}>Error Message</span><div style={{ fontSize: '12px', color: C.red, background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '4px', marginTop: '4px', fontFamily: F.mono }}>{f.errorMessage || f.error_message}</div></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                      <div className="kv"><span style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase' }}>Payment Intent</span><span style={{ fontSize: '12px', color: C.text, fontFamily: F.mono }}>{f.paymentIntentId || f.payment_intent_id}</span></div>
                      <div className="kv"><span style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase' }}>Retry Count</span><span style={{ fontSize: '12px', color: C.text, fontFamily: F.mono }}>{f.retryCount ?? f.retry_count}</span></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Panel 3: Health */}
        {activeTab === 'health' && (
          <div style={{ animation: 'fadeIn .3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.text, fontFamily: F.syne }}>System Health Check</h2>
                <p style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>Live validation of all platform services including Stripe startup gate.</p>
              </div>
              <button data-testid="button-refresh-health" onClick={loadData} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>↻ Refresh</button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}><div style={{ width: '20px', height: '20px', border: `2px solid ${C.border}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }}></div></div>
            ) : healthData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                {Object.entries(healthData.systems || {}).map(([name, val]: [string, any]) => {
                  const statusText = typeof val === 'string' ? val : (val as any).status || 'Unknown';
                  const isOk = statusText.startsWith('OK');
                  const isFail = statusText.startsWith('FAIL');
                  const isWarn = statusText.startsWith('WARN');
                  
                  return (
                    <div key={name} data-testid={`status-${name}`} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px 18px' }}>
                      <div style={{ fontSize: '11px', color: C.muted, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '6px' }}>{name.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: isOk ? C.green : isFail ? C.red : isWarn ? C.yellow : C.text }}>{statusText}</div>
                      {typeof val === 'object' && (val as any).validated_at && (
                        <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px' }}>Validated: {new Date((val as any).validated_at).toLocaleTimeString()}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {/* Panel 4: Autonomous Marketplace */}
        {activeTab === 'autonomy' && (
          <div style={{ animation: 'fadeIn .3s ease', color: C.text, fontFamily: F.syne }}>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.text, fontFamily: F.syne }}>Autonomous Marketplace</h2>
              <p style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>Review queue, RFQ matches, payout pipeline, and exception triage.</p>
            </div>
            <AutonomousMarketplaceAdmin adminKey={adminKey} />
          </div>
        )}

        {/* Panel 5: Backup & DR */}
        {activeTab === 'backup' && (
          <div style={{ animation: 'fadeIn .3s ease', color: C.text, fontFamily: F.syne }}>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.text, fontFamily: F.syne }}>Backup & Disaster Recovery</h2>
              <p style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>
                Daily automated backups with SHA-256 integrity verification. S3-compatible off-site storage.
                See <code style={{ color: C.gold, fontSize: '11px' }}>docs/BACKUP_ROLLBACK_RUNBOOK.md</code> for the full DR policy, restore procedure, and test checklist.
              </p>
            </div>
            <BackupAdmin adminKey={adminKey} />
          </div>
        )}

      <section style={{ padding: '0 24px 40px', maxWidth: 1400, margin: '0 auto' }}>
        <IncidentBanner status={platformStatus.status} message={platformStatus.message} />
        <EnterpriseOpsDashboard adminKey={adminKey} />
        <LaunchChecklist />
      </section>

      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}


