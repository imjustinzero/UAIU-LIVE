import { useState, useEffect } from "react";
import { useLocation } from "wouter";

const C = {
  bg: '#060810',
  surface: '#0d1220',
  surface2: '#111f35',
  border: 'rgba(212,168,67,0.2)',
  gold: '#d4a843',
  text: '#f2ead8',
  muted: '#8fa3b1',
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#eab308',
};

function getToken(): string | null {
  return localStorage.getItem('x-exchange-token') || sessionStorage.getItem('x-exchange-token');
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { 'X-Exchange-Token': t } : {};
}

type ConnectStatus = {
  hasProfile: boolean;
  sellerProfileId?: string;
  onboardingStatus?: string;
  connectAccountId?: string | null;
  connectOnboardingComplete?: boolean;
  connectDetailsSubmitted?: boolean;
  connectStatus?: {
    id?: string;
    detailsSubmitted?: boolean;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    requirementsDue?: string[];
    disabledReason?: string | null;
    ready?: boolean;
    error?: string;
  } | null;
  payoutHistory?: any[];
};

type PayoutRow = {
  id: string;
  trade_id: string;
  seller_net_eur: number;
  gross_eur: number;
  fee_eur: number;
  payout_status: string;
  payout_provider: string;
  stripe_transfer_id?: string;
  failure_reason?: string;
  created_at: string;
  released_at?: string;
};

const statusColor = (s: string) =>
  s === 'paid' || s === 'released' ? C.green
  : s === 'failed' ? C.red
  : s === 'pending_connect' ? C.yellow
  : C.muted;

export default function SellerConnect() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const token = getToken();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connect') === 'success') {
      setSuccessMsg('Stripe onboarding completed. Refreshing status...');
      window.history.replaceState({}, '', '/x/seller');
    }
    if (params.get('refresh') === '1') {
      handleRefreshLink();
    }
    loadStatus();
  }, []);

  async function loadStatus() {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/seller/connect/status', { headers: authHeaders() });
      if (!r.ok) { setError('Could not load seller status.'); return; }
      const data = await r.json();
      setStatus(data);
    } catch {
      setError('Network error loading status.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStartOnboarding() {
    if (!token) return;
    setActionLoading(true);
    setError('');
    try {
      const r = await fetch('/api/seller/connect/onboard', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Onboarding failed.'); return; }
      window.location.href = data.onboardingUrl;
    } catch {
      setError('Could not start onboarding. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRefreshLink() {
    if (!token) return;
    setActionLoading(true);
    setError('');
    try {
      const r = await fetch('/api/seller/connect/refresh-link', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Could not get new link.'); return; }
      window.location.href = data.onboardingUrl;
    } catch {
      setError('Could not refresh link. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  if (!token) {
    return (
      <main style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: C.gold, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>UAIU.LIVE/X</div>
          <h1 style={{ marginBottom: 12 }}>Seller Payouts</h1>
          <p style={{ color: C.muted, marginBottom: 24 }}>You must be signed in to your Exchange account to access this page.</p>
          <button
            data-testid="button-go-exchange"
            onClick={() => setLocation('/x')}
            style={{ background: C.gold, color: '#060810', border: 'none', borderRadius: 6, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}
          >
            Go to Exchange
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '48px 20px' }}>
      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        <div style={{ color: C.gold, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>UAIU.LIVE/X</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Seller Payouts</h1>
          <button
            data-testid="button-refresh-status"
            onClick={loadStatus}
            disabled={loading}
            style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            data-testid="button-go-back"
            onClick={() => setLocation('/x')}
            style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, marginLeft: 'auto' }}
          >
            Back to Exchange
          </button>
        </div>

        {successMsg && (
          <div data-testid="status-connect-success" style={{ background: 'rgba(34,197,94,0.1)', border: `1px solid ${C.green}`, borderRadius: 6, padding: 14, marginBottom: 20, color: C.green, fontSize: 13 }}>
            {successMsg}
          </div>
        )}
        {error && (
          <div data-testid="status-connect-error" style={{ background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.red}`, borderRadius: 6, padding: 14, marginBottom: 20, color: C.red, fontSize: 13 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ width: 20, height: 20, border: `2px solid ${C.border}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
          </div>
        ) : !status?.hasProfile ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 28 }}>
            <h2 style={{ color: C.gold, fontSize: 16, marginBottom: 8 }}>No Seller Profile Found</h2>
            <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.6 }}>
              You need to complete seller onboarding before setting up payouts.
              Visit the Exchange and use the Seller Onboarding form to create your profile first.
            </p>
          </div>
        ) : (
          <>
            {/* Connect Status Card */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>Stripe Connect Status</div>

              {!status.connectAccountId ? (
                <div>
                  <p style={{ color: C.text, fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
                    Connect a Stripe account to receive payouts directly to your bank account when trades settle.
                  </p>
                  <button
                    data-testid="button-start-connect-onboarding"
                    onClick={handleStartOnboarding}
                    disabled={actionLoading}
                    style={{ background: C.gold, color: '#060810', border: 'none', borderRadius: 6, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
                  >
                    {actionLoading ? 'Setting up...' : 'Set Up Payout Account'}
                  </button>
                </div>
              ) : status.connectStatus?.error ? (
                <div>
                  <div style={{ color: C.yellow, fontSize: 13, marginBottom: 12 }}>Could not retrieve Stripe account status. Your account ID: <code style={{ color: C.gold }}>{status.connectAccountId}</code></div>
                  <button data-testid="button-refresh-connect-link" onClick={handleRefreshLink} disabled={actionLoading}
                    style={{ background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold, borderRadius: 6, padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}>
                    {actionLoading ? 'Loading...' : 'Resume Onboarding'}
                  </button>
                </div>
              ) : status.connectOnboardingComplete ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ color: C.green, fontSize: 18 }}>✓</span>
                    <span style={{ color: C.green, fontWeight: 700, fontSize: 15 }}>Payout Account Active</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'Account ID', value: status.connectAccountId },
                      { label: 'Details Submitted', value: status.connectStatus?.detailsSubmitted ? 'Yes' : 'No' },
                      { label: 'Payouts Enabled', value: status.connectStatus?.payoutsEnabled ? 'Yes' : 'No' },
                      { label: 'Charges Enabled', value: status.connectStatus?.chargesEnabled ? 'Yes' : 'No' },
                    ].map(row => (
                      <div key={row.label} style={{ background: C.surface2, borderRadius: 6, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{row.label}</div>
                        <div style={{ fontSize: 13, color: C.text, wordBreak: 'break-all' }}>{String(row.value)}</div>
                      </div>
                    ))}
                  </div>
                  {(status.connectStatus?.requirementsDue?.length ?? 0) > 0 && (
                    <div style={{ marginTop: 14, background: 'rgba(234,179,8,0.1)', border: `1px solid ${C.yellow}`, borderRadius: 6, padding: 12 }}>
                      <div style={{ color: C.yellow, fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Action Required</div>
                      {status.connectStatus?.requirementsDue?.map((req: string, i: number) => (
                        <div key={i} style={{ fontSize: 12, color: C.yellow, opacity: 0.85 }}>{req}</div>
                      ))}
                      <button data-testid="button-complete-requirements" onClick={handleRefreshLink} disabled={actionLoading}
                        style={{ marginTop: 10, background: C.yellow, color: '#060810', border: 'none', borderRadius: 6, padding: '7px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                        Complete Requirements
                      </button>
                    </div>
                  )}
                  {status.connectStatus?.disabledReason && (
                    <div style={{ marginTop: 14, background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.red}`, borderRadius: 6, padding: 12 }}>
                      <div style={{ color: C.red, fontWeight: 600, fontSize: 13 }}>Account Restricted</div>
                      <div style={{ color: C.red, fontSize: 12, opacity: 0.85, marginTop: 4 }}>{status.connectStatus.disabledReason}</div>
                      <button data-testid="button-resolve-restrictions" onClick={handleRefreshLink} disabled={actionLoading}
                        style={{ marginTop: 10, background: 'transparent', border: `1px solid ${C.red}`, color: C.red, borderRadius: 6, padding: '7px 18px', cursor: 'pointer', fontSize: 12 }}>
                        Resolve in Stripe
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span style={{ color: C.yellow, fontSize: 15, fontWeight: 700 }}>Onboarding Incomplete</span>
                  </div>
                  <p style={{ color: C.muted, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                    Your Stripe account setup is not yet complete. Finish onboarding to enable payouts.
                    Your account ID: <code style={{ color: C.gold }}>{status.connectAccountId}</code>
                  </p>
                  <button
                    data-testid="button-continue-onboarding"
                    onClick={handleRefreshLink}
                    disabled={actionLoading}
                    style={{ background: C.gold, color: '#060810', border: 'none', borderRadius: 6, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
                  >
                    {actionLoading ? 'Loading...' : 'Continue Onboarding'}
                  </button>
                </div>
              )}
            </div>

            {/* Payout History */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>Payout History</div>
              {!status.payoutHistory?.length ? (
                <div style={{ color: C.muted, fontSize: 13 }}>No payouts yet. Payouts appear here once trades settle.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {status.payoutHistory.map((p: PayoutRow) => (
                    <div key={p.id} data-testid={`row-payout-${p.id}`}
                      style={{ background: C.surface2, borderRadius: 6, padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                      <div>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Trade {p.trade_id}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>€{Number(p.seller_net_eur).toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                          Gross: €{Number(p.gross_eur).toFixed(2)} · Fee: €{Number(p.fee_eur).toFixed(2)} · Provider: {p.payout_provider}
                        </div>
                        {p.stripe_transfer_id && (
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Transfer: {p.stripe_transfer_id}</div>
                        )}
                        {p.failure_reason && (
                          <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{p.failure_reason}</div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: `${statusColor(p.payout_status)}22`, color: statusColor(p.payout_status), border: `1px solid ${statusColor(p.payout_status)}44` }}>
                          {p.payout_status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                          {new Date(p.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
