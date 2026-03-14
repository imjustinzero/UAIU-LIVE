import { useEffect, useState } from "react";

type Props = { adminKey: string };

const C = {
  gold: '#d4a843',
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#eab308',
  muted: '#8fa3b1',
  surface: '#111f35',
  border: 'rgba(212,168,67,0.15)',
};

const payoutStatusColor = (s: string) =>
  s === 'paid' || s === 'released' ? C.green
  : s === 'failed' ? C.red
  : s === 'pending_connect' ? C.yellow
  : C.muted;

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
      background: `${color}22`, color, border: `1px solid ${color}44`, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

type Tab = 'payouts' | 'sellers' | 'rfq' | 'review' | 'exceptions';

export function AutonomousMarketplaceAdmin({ adminKey }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('payouts');

  async function load() {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/autonomous-marketplace/queue", {
        headers: { "X-Admin-Key": adminKey },
      });
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  async function resolveException(id: string) {
    await fetch(`/api/admin/exceptions/${id}/resolve`, {
      method: "POST",
      headers: { "X-Admin-Key": adminKey },
    });
    load();
  }

  async function releasePayout(tradeId: string) {
    const r = await fetch(`/api/exchange/payout/release/${tradeId}`, {
      method: "POST",
      headers: { "X-Admin-Key": adminKey },
    });
    const d = await r.json();
    alert(r.ok
      ? `Payout released. Method: ${d.method || 'N/A'}. Transfer: ${d.transferId || 'N/A'}`
      : `Error: ${d.error || d.detail || 'Unknown error'}`);
    load();
  }

  useEffect(() => { load(); }, [adminKey]);

  const payouts: any[] = data?.payouts || [];
  const sellers: any[] = data?.sellerProfiles || [];
  const exceptions: any[] = data?.exceptions || [];
  const rfq: any[] = data?.rfqMatches || [];
  const review: any[] = data?.reviewQueue || [];

  const stats = {
    paid: payouts.filter(p => p.payout_status === 'paid' || p.payout_status === 'released').length,
    pending: payouts.filter(p => p.payout_status === 'pending_release').length,
    pendingConnect: payouts.filter(p => p.payout_status === 'pending_connect').length,
    failed: payouts.filter(p => p.payout_status === 'failed').length,
    noConnect: sellers.filter(s => !s.stripe_connect_account_id).length,
    incomplete: sellers.filter(s => s.stripe_connect_account_id && !s.connect_onboarding_complete).length,
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'payouts', label: 'Payouts', count: payouts.length },
    { id: 'sellers', label: 'Sellers / Connect', count: sellers.length },
    { id: 'rfq', label: 'RFQ Matches', count: rfq.length },
    { id: 'review', label: 'Review Queue', count: review.length },
    { id: 'exceptions', label: 'Exceptions', count: exceptions.filter(e => e.status === 'open').length },
  ];

  return (
    <div style={{ color: '#f2ead8', fontFamily: 'inherit' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Paid', value: stats.paid, color: C.green },
          { label: 'Pending Release', value: stats.pending, color: C.muted },
          { label: 'Pending Connect', value: stats.pendingConnect, color: C.yellow },
          { label: 'Failed', value: stats.failed, color: C.red },
          { label: 'No Connect Account', value: stats.noConnect, color: C.yellow },
          { label: 'Onboarding Incomplete', value: stats.incomplete, color: C.yellow },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            data-testid={`tab-autonomy-${t.id}`}
            style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none', background: 'transparent',
              cursor: 'pointer', color: activeTab === t.id ? C.gold : C.muted,
              borderBottom: `2px solid ${activeTab === t.id ? C.gold : 'transparent'}`, marginBottom: -1 }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ marginLeft: 5, background: activeTab === t.id ? `${C.gold}33` : 'rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '1px 6px', fontSize: 10,
                color: activeTab === t.id ? C.gold : C.muted }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
        <button onClick={load} disabled={loading} data-testid="button-autonomy-refresh"
          style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 11, border: `1px solid ${C.border}`,
            background: 'transparent', color: C.muted, borderRadius: 6, cursor: 'pointer', alignSelf: 'center' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Payouts */}
      {activeTab === 'payouts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!payouts.length
            ? <div style={{ color: C.muted, fontSize: 13 }}>No payouts yet.</div>
            : payouts.map(p => (
              <div key={p.id} data-testid={`row-payout-${p.id}`}
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>Trade {p.trade_id} · {p.seller_email}</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    €{Number(p.seller_net_eur).toLocaleString()} net
                    <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}> (gross €{Number(p.gross_eur || 0).toFixed(2)} · fee €{Number(p.fee_eur || 0).toFixed(2)})</span>
                  </div>
                  {p.legal_entity_name && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{p.legal_entity_name}</div>}
                  {p.stripe_transfer_id && <div style={{ fontSize: 11, color: C.muted }}>Transfer: {p.stripe_transfer_id}</div>}
                  {p.connect_account_id && <div style={{ fontSize: 11, color: C.muted }}>Connect: {p.connect_account_id}</div>}
                  {!p.stripe_connect_account_id && (
                    <div style={{ fontSize: 11, color: C.yellow, marginTop: 3 }}>
                      No Connect account — seller must complete payout onboarding at /x/seller
                    </div>
                  )}
                  {p.stripe_connect_account_id && !p.connect_onboarding_complete && (
                    <div style={{ fontSize: 11, color: C.yellow, marginTop: 3 }}>Connect onboarding incomplete</div>
                  )}
                  {p.failure_reason && <div style={{ fontSize: 11, color: C.red, marginTop: 3 }}>{p.failure_reason}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <Chip label={p.payout_status.replace(/_/g, ' ').toUpperCase()} color={payoutStatusColor(p.payout_status)} />
                  {(p.payout_status === 'pending_release' || p.payout_status === 'pending_connect') && (
                    <button onClick={() => releasePayout(p.trade_id)} data-testid={`button-release-payout-${p.id}`}
                      style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, border: 'none',
                        background: C.gold, color: '#060810', borderRadius: 6, cursor: 'pointer' }}>
                      Release
                    </button>
                  )}
                  <button onClick={() => window.open(`/api/exchange/trade/${encodeURIComponent(p.trade_id)}/audit-pack`, '_blank')} style={{ padding: '5px 12px', fontSize: 11, border: `1px solid ${C.border}`, background: 'transparent', color: C.gold, borderRadius: 6, cursor: 'pointer' }}>Download EU ETS Audit Pack (.pdf)</button>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Sellers */}
      {activeTab === 'sellers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!sellers.length
            ? <div style={{ color: C.muted, fontSize: 13 }}>No seller profiles yet.</div>
            : sellers.map(s => (
              <div key={s.id} data-testid={`row-seller-${s.id}`}
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '12px 16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.legal_entity_name}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{s.exchange_account_email}</span>
                  <Chip label={s.onboarding_status} color={C.muted} />
                  <Chip label={`KYB: ${s.kyb_status}`} color={s.kyb_status === 'verified' ? C.green : C.yellow} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {s.stripe_connect_account_id ? (
                    <>
                      <Chip label={`ID: ${s.stripe_connect_account_id}`} color={C.muted} />
                      <Chip
                        label={s.connect_onboarding_complete ? 'Payout Ready' : 'Onboarding Incomplete'}
                        color={s.connect_onboarding_complete ? C.green : C.yellow}
                      />
                      <Chip
                        label={s.connect_details_submitted ? 'Details Submitted' : 'Details Pending'}
                        color={s.connect_details_submitted ? C.green : C.yellow}
                      />
                    </>
                  ) : (
                    <Chip label="No Connect Account" color={C.red} />
                  )}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* RFQ */}
      {activeTab === 'rfq' && (
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: C.muted, background: C.surface, padding: 14, borderRadius: 6, maxHeight: 500, overflow: 'auto' }}>
          {JSON.stringify(rfq, null, 2)}
        </pre>
      )}

      {/* Review Queue */}
      {activeTab === 'review' && (
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: C.muted, background: C.surface, padding: 14, borderRadius: 6, maxHeight: 500, overflow: 'auto' }}>
          {JSON.stringify(review, null, 2)}
        </pre>
      )}

      {/* Exceptions */}
      {activeTab === 'exceptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!exceptions.length
            ? <div style={{ color: C.muted, fontSize: 13 }}>No open exceptions.</div>
            : exceptions.map(ex => (
              <div key={ex.id} data-testid={`row-exception-${ex.id}`}
                style={{ background: C.surface, border: `1px solid ${ex.severity === 'high' ? C.red : ex.severity === 'medium' ? C.yellow : C.border}`, borderRadius: 6, padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <Chip label={ex.severity.toUpperCase()} color={ex.severity === 'high' ? C.red : ex.severity === 'medium' ? C.yellow : C.muted} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{ex.code}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{ex.entity_type} / {ex.entity_id}</span>
                  <Chip label={ex.status} color={ex.status === 'open' ? C.yellow : C.green} />
                </div>
                <div style={{ fontSize: 13, marginBottom: 10 }}>{ex.message}</div>
                {ex.status === 'open' && (
                  <button onClick={() => resolveException(ex.id)} data-testid={`button-resolve-exception-${ex.id}`}
                    style={{ padding: '5px 14px', fontSize: 11, fontWeight: 700, border: `1px solid ${C.green}`,
                      background: 'transparent', color: C.green, borderRadius: 6, cursor: 'pointer' }}>
                    Mark Resolved
                  </button>
                )}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}
