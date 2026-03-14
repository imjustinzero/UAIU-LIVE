import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Check, Lock, AlertCircle, ChevronRight, ExternalLink, Loader2, RefreshCw } from "lucide-react";

const C = {
  bg: '#060810',
  surface: '#0d1220',
  surface2: '#111f35',
  border: 'rgba(212,168,67,0.2)',
  gold: '#d4a843',
  gold2: '#f0c96a',
  goldFaint: 'rgba(212,168,67,0.08)',
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
  return t ? { 'X-Exchange-Token': t, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

type StepStatus = 'not_started' | 'in_progress' | 'complete' | 'blocked';

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
  payoutHistory?: PayoutRow[];
};

type SellerProfile = {
  id: string;
  legal_entity_name?: string;
  trading_name?: string;
  seller_type?: string;
  country?: string;
  registry_name?: string;
  registry_account_id?: string;
  website?: string;
  tax_id?: string;
  onboarding_status?: string;
  kyb_status?: string;
  kyc_status?: string;
};

type AccountData = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  kycStatus?: string;
  kycCompletedAt?: string;
  accountType?: string;
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

type ListingRow = {
  id: string;
  name: string;
  standard: string;
  status: string;
  pricePerTonne: number;
  volumeTonnes?: number;
  origin?: string;
  registrySerial?: string;
  registryName?: string;
  vintageYear?: number;
};

const statusColor = (s: string) =>
  s === 'paid' || s === 'released' ? C.green
  : s === 'failed' ? C.red
  : s === 'pending_connect' ? C.yellow
  : C.muted;

function StepIcon({ status, stepNum }: { status: StepStatus; stepNum: number }) {
  if (status === 'complete') return <div data-testid={`step-icon-${stepNum}`} style={{ width: 32, height: 32, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={16} color="#fff" /></div>;
  if (status === 'blocked') return <div data-testid={`step-icon-${stepNum}`} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: `1px solid ${C.red}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={14} color={C.red} /></div>;
  if (status === 'in_progress') return <div data-testid={`step-icon-${stepNum}`} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(212,168,67,0.15)', border: `2px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontSize: 13, fontWeight: 700 }}>{stepNum}</div>;
  return <div data-testid={`step-icon-${stepNum}`} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(143,163,177,0.1)', border: `1px solid rgba(143,163,177,0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13, fontWeight: 700 }}>{stepNum}</div>;
}

const STEP_LABELS = ['Account', 'Identity (KYC)', 'Business (KYB)', 'Stripe Connect', 'Active Seller'];

function ProgressStepper({ steps, activeStep }: { steps: { label: string; status: StepStatus }[]; activeStep: number }) {
  return (
    <div data-testid="progress-stepper" style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 32, overflowX: 'auto', padding: '4px 0' }}>
      {steps.map((step, i) => {
        const isActive = i === activeStep;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div data-testid={`step-${i + 1}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 80 }}>
              <StepIcon status={step.status} stepNum={i + 1} />
              <div style={{ fontSize: 11, fontWeight: isActive ? 700 : 400, color: isActive ? C.gold : step.status === 'complete' ? C.green : C.muted, textAlign: 'center', lineHeight: 1.3, maxWidth: 90 }}>
                {step.label}
              </div>
              <div data-testid={`step-status-${i + 1}`} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: step.status === 'complete' ? C.green : step.status === 'in_progress' ? C.gold : step.status === 'blocked' ? C.red : C.muted }}>
                {step.status.replace(/_/g, ' ')}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: step.status === 'complete' ? C.green : `rgba(143,163,177,0.15)`, margin: '0 8px', marginBottom: 32, minWidth: 20 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SellerConnect() {
  const [, setLocation] = useLocation();
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [kybLegalName, setKybLegalName] = useState('');
  const [kybTradingName, setKybTradingName] = useState('');
  const [kybSellerType, setKybSellerType] = useState('corporate');
  const [kybCountry, setKybCountry] = useState('');
  const [kybRegistryName, setKybRegistryName] = useState('');
  const [kybRegistryAccountId, setKybRegistryAccountId] = useState('');
  const [kybWebsite, setKybWebsite] = useState('');
  const [kybTaxId, setKybTaxId] = useState('');

  const token = getToken();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isConnectReturn = params.get('connect') === 'success';
    if (isConnectReturn) {
      setSuccessMsg('Stripe onboarding completed. Refreshing status...');
      window.history.replaceState({}, '', '/x/seller');
    }
    if (params.get('refresh') === '1') {
      handleRefreshLink();
    }
    loadAllData();

    if (isConnectReturn && token) {
      let attempts = 0;
      const pollInterval = window.setInterval(async () => {
        attempts++;
        try {
          const r = await fetch('/api/seller/connect/status', { headers: { 'X-Exchange-Token': token } });
          if (r.ok) {
            const data = await r.json();
            setConnectStatus(data);
            if (data.sellerProfile) setSellerProfile(data.sellerProfile);
            if (data.connectStatus?.chargesEnabled && data.connectStatus?.payoutsEnabled) {
              setSuccessMsg('Stripe Connect is fully active. Charges and payouts are enabled.');
              window.clearInterval(pollInterval);
            }
          }
        } catch {}
        if (attempts >= 10) {
          window.clearInterval(pollInterval);
        }
      }, 3000);
      return () => window.clearInterval(pollInterval);
    }
  }, []);

  async function loadAllData() {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const [connectRes, accountRes] = await Promise.all([
        fetch('/api/seller/connect/status', { headers: { 'X-Exchange-Token': token } }),
        fetch('/api/exchange/account/verify-token', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Exchange-Token': token } }),
      ]);

      if (connectRes.ok) {
        const data = await connectRes.json();
        setConnectStatus(data);
        if (data.sellerProfile) {
          setSellerProfile(data.sellerProfile);
        }
      }

      if (accountRes.ok) {
        const acct = await accountRes.json();
        if (acct?.email) {
          setAccount({
            id: acct.id,
            email: acct.email,
            firstName: acct.firstName,
            lastName: acct.lastName,
            kycStatus: acct.kycStatus || 'not_started',
            kycCompletedAt: acct.kycCompletedAt || null,
            accountType: acct.accountType,
          });
        }
      }

      try {
        const listRes = await fetch('/api/seller/my-listings', { headers: { 'X-Exchange-Token': token } });
        if (listRes.ok) {
          const myListings = await listRes.json();
          if (Array.isArray(myListings)) {
            setListings(myListings);
          }
        }
      } catch {}

    } catch {
      setError('Network error loading data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleKybSubmit() {
    if (!token) return;
    if (!kybLegalName || !kybRegistryName || !kybRegistryAccountId) {
      setError('Legal entity name, registry name, and registry account ID are required.');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const r = await fetch('/api/seller/onboard/automatic', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          legalEntityName: kybLegalName,
          tradingName: kybTradingName || undefined,
          sellerType: kybSellerType,
          country: kybCountry || undefined,
          registryName: kybRegistryName,
          registryAccountId: kybRegistryAccountId,
          website: kybWebsite || undefined,
          taxId: kybTaxId || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'KYB submission failed.'); return; }
      setSuccessMsg('Business verification submitted successfully.');
      if (data.sellerProfile) setSellerProfile(data.sellerProfile);
      await loadAllData();
    } catch {
      setError('Could not submit business verification. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartConnectOnboarding() {
    if (!token) return;
    setActionLoading(true);
    setError('');
    try {
      const r = await fetch('/api/seller/connect/onboard', {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Stripe Connect onboarding failed.'); return; }
      window.location.href = data.onboardingUrl;
    } catch {
      setError('Could not start Stripe onboarding. Please try again.');
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
        headers: authHeaders(),
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

  const hasAccount = !!account?.email;
  const kycVerified = account?.kycStatus === 'verified';
  const hasSellerProfile = connectStatus?.hasProfile || !!sellerProfile;
  const onboardingStatus = connectStatus?.onboardingStatus || sellerProfile?.onboarding_status;
  const kybApproved = onboardingStatus === 'active';
  const kybPending = !kybApproved && (onboardingStatus === 'pending_kyb' || onboardingStatus === 'pending');
  const kybRejected = onboardingStatus === 'blocked';
  const hasConnectAccount = !!connectStatus?.connectAccountId;
  const connectComplete = connectStatus?.connectOnboardingComplete || false;
  const chargesEnabled = connectStatus?.connectStatus?.chargesEnabled || false;
  const payoutsEnabled = connectStatus?.connectStatus?.payoutsEnabled || false;
  const fullyOnboarded = hasAccount && kycVerified && hasSellerProfile && kybApproved && connectComplete && chargesEnabled;

  function getStepStatuses(): { label: string; status: StepStatus }[] {
    const accountStatus: StepStatus = hasAccount ? 'complete' : 'not_started';
    const kycStatus: StepStatus = !hasAccount ? 'blocked' : kycVerified ? 'complete' : account?.kycStatus === 'pending' ? 'in_progress' : 'not_started';
    const kybStepStatus: StepStatus = !kycVerified ? 'blocked' : kybApproved ? 'complete' : kybPending ? 'in_progress' : kybRejected ? 'not_started' : hasSellerProfile ? 'in_progress' : 'not_started';
    const connectStepStatus: StepStatus = !kybApproved ? 'blocked' : (connectComplete && chargesEnabled) ? 'complete' : hasConnectAccount ? 'in_progress' : 'not_started';
    const activeStatus: StepStatus = !connectComplete || !chargesEnabled ? 'blocked' : 'complete';

    return [
      { label: STEP_LABELS[0], status: accountStatus },
      { label: STEP_LABELS[1], status: kycStatus },
      { label: STEP_LABELS[2], status: kybStepStatus },
      { label: STEP_LABELS[3], status: connectStepStatus },
      { label: STEP_LABELS[4], status: activeStatus },
    ];
  }

  function getActiveStep(): number {
    if (!hasAccount) return 0;
    if (!kycVerified) return 1;
    if (!kybApproved) return 2;
    if (!connectComplete || !chargesEnabled) return 3;
    return 4;
  }

  const stepStatuses = getStepStatuses();
  const activeStep = getActiveStep();

  if (!token) {
    return (
      <main style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: C.gold, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>UAIU.LIVE/X</div>
          <h1 style={{ marginBottom: 12 }}>Seller Onboarding</h1>
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
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ color: C.gold, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>UAIU.LIVE/X</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Seller Onboarding</h1>
          <button
            data-testid="button-refresh-status"
            onClick={loadAllData}
            disabled={loading}
            style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={12} />
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
          <div data-testid="status-connect-success" style={{ background: 'rgba(34,197,94,0.1)', border: `1px solid ${C.green}`, borderRadius: 6, padding: 14, marginBottom: 20, color: C.green, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={16} /> {successMsg}
          </div>
        )}
        {error && (
          <div data-testid="status-connect-error" style={{ background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.red}`, borderRadius: 6, padding: 14, marginBottom: 20, color: C.red, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Loader2 size={24} color={C.gold} style={{ animation: 'spin .7s linear infinite' }} />
          </div>
        ) : (
          <>
            <ProgressStepper steps={stepStatuses} activeStep={activeStep} />

            {/* Step 1: Account */}
            {activeStep === 0 && (
              <StepCard title="Step 1: Create Your Account" description="Create an Exchange account to get started as a seller." status={stepStatuses[0].status}>
                <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  You need an Exchange account before you can begin seller onboarding. Visit the Exchange to create your account.
                </p>
                <button data-testid="button-create-account" onClick={() => setLocation('/x')} style={btnPrimary}>
                  Create Account on Exchange <ChevronRight size={14} />
                </button>
              </StepCard>
            )}

            {/* Step 2: KYC */}
            {activeStep === 1 && (
              <StepCard title="Step 2: Identity Verification (KYC)" description="Complete identity verification to unlock seller features." status={stepStatuses[1].status}>
                {account?.kycStatus === 'pending' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(234,179,8,0.08)', border: `1px solid rgba(234,179,8,0.2)`, borderRadius: 6 }}>
                    <Loader2 size={16} color={C.yellow} style={{ animation: 'spin 1s linear infinite' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.yellow }}>Verification In Progress</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Your identity verification is being reviewed. This usually takes a few minutes.</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                      Identity verification (KYC) is required before you can set up your seller profile. Visit the Exchange to start verification.
                    </p>
                    <button data-testid="button-start-kyc" onClick={() => setLocation('/x')} style={btnPrimary}>
                      Start KYC Verification <ChevronRight size={14} />
                    </button>
                  </>
                )}
              </StepCard>
            )}

            {/* Step 3: KYB */}
            {activeStep === 2 && (
              <StepCard title="Step 3: Business Verification (KYB)" description="Register your company and carbon credit registry details." status={stepStatuses[2].status}>
                {kybPending ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(234,179,8,0.08)', border: `1px solid rgba(234,179,8,0.2)`, borderRadius: 6 }}>
                    <Loader2 size={16} color={C.yellow} style={{ animation: 'spin 1s linear infinite' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.yellow }}>KYB Under Review</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Your business verification is being reviewed by our team. Once approved, you will be able to set up Stripe Connect for payouts.</div>
                    </div>
                  </div>
                ) : kybRejected ? (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 6, marginBottom: 16 }}>
                      <AlertCircle size={16} color={C.red} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.red }}>KYB Rejected</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Your business verification was rejected. Please review your details and resubmit.</div>
                      </div>
                    </div>
                    <KybForm
                      kybLegalName={kybLegalName} setKybLegalName={setKybLegalName}
                      kybTradingName={kybTradingName} setKybTradingName={setKybTradingName}
                      kybSellerType={kybSellerType} setKybSellerType={setKybSellerType}
                      kybCountry={kybCountry} setKybCountry={setKybCountry}
                      kybRegistryName={kybRegistryName} setKybRegistryName={setKybRegistryName}
                      kybRegistryAccountId={kybRegistryAccountId} setKybRegistryAccountId={setKybRegistryAccountId}
                      kybWebsite={kybWebsite} setKybWebsite={setKybWebsite}
                      kybTaxId={kybTaxId} setKybTaxId={setKybTaxId}
                      onSubmit={handleKybSubmit}
                      loading={actionLoading}
                    />
                  </div>
                ) : (
                  <KybForm
                    kybLegalName={kybLegalName} setKybLegalName={setKybLegalName}
                    kybTradingName={kybTradingName} setKybTradingName={setKybTradingName}
                    kybSellerType={kybSellerType} setKybSellerType={setKybSellerType}
                    kybCountry={kybCountry} setKybCountry={setKybCountry}
                    kybRegistryName={kybRegistryName} setKybRegistryName={setKybRegistryName}
                    kybRegistryAccountId={kybRegistryAccountId} setKybRegistryAccountId={setKybRegistryAccountId}
                    kybWebsite={kybWebsite} setKybWebsite={setKybWebsite}
                    kybTaxId={kybTaxId} setKybTaxId={setKybTaxId}
                    onSubmit={handleKybSubmit}
                    loading={actionLoading}
                  />
                )}
              </StepCard>
            )}

            {/* Step 4: Stripe Connect */}
            {activeStep === 3 && (
              <StepCard title="Step 4: Stripe Connect" description="Connect a bank account to receive payouts when trades settle." status={stepStatuses[3].status}>
                {!hasConnectAccount ? (
                  <div>
                    <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                      Connect a Stripe account to receive payouts directly to your bank account when trades settle. Stripe handles all payment processing securely.
                    </p>
                    <button data-testid="button-start-connect-onboarding" onClick={handleStartConnectOnboarding} disabled={actionLoading} style={btnPrimary}>
                      {actionLoading ? <><Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} /> Setting up...</> : <>Connect Bank Account <ExternalLink size={14} /></>}
                    </button>
                  </div>
                ) : connectStatus?.connectStatus?.error ? (
                  <div>
                    <div style={{ color: C.yellow, fontSize: 13, marginBottom: 12 }}>Could not retrieve Stripe account status. Account ID: <code style={{ color: C.gold }}>{connectStatus.connectAccountId}</code></div>
                    <button data-testid="button-refresh-connect-link" onClick={handleRefreshLink} disabled={actionLoading} style={btnOutline}>
                      {actionLoading ? 'Loading...' : 'Resume Onboarding'}
                    </button>
                  </div>
                ) : connectComplete && chargesEnabled ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <Check size={18} color={C.green} />
                      <span style={{ color: C.green, fontWeight: 700, fontSize: 15 }}>Payout Account Active</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {[
                        { label: 'Account ID', value: connectStatus?.connectAccountId },
                        { label: 'Details Submitted', value: connectStatus?.connectStatus?.detailsSubmitted ? 'Yes' : 'No' },
                        { label: 'Payouts Enabled', value: payoutsEnabled ? 'Yes' : 'No' },
                        { label: 'Charges Enabled', value: chargesEnabled ? 'Yes' : 'No' },
                      ].map(row => (
                        <div key={row.label} style={{ background: C.surface2, borderRadius: 6, padding: '10px 14px' }}>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{row.label}</div>
                          <div data-testid={`text-connect-${row.label.toLowerCase().replace(/\s/g, '-')}`} style={{ fontSize: 13, color: C.text, wordBreak: 'break-all' }}>{String(row.value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <Loader2 size={16} color={C.yellow} style={{ animation: 'spin 1s linear infinite' }} />
                      <span style={{ color: C.yellow, fontSize: 15, fontWeight: 700 }}>Onboarding Incomplete</span>
                    </div>
                    <p style={{ color: C.muted, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                      Your Stripe account setup is not yet complete. Finish onboarding to enable payouts.
                      Account ID: <code style={{ color: C.gold }}>{connectStatus?.connectAccountId}</code>
                    </p>
                    <button data-testid="button-continue-onboarding" onClick={handleRefreshLink} disabled={actionLoading} style={btnPrimary}>
                      {actionLoading ? 'Loading...' : 'Continue Onboarding'}
                    </button>
                    {(connectStatus?.connectStatus?.requirementsDue?.length ?? 0) > 0 && (
                      <div style={{ marginTop: 14, background: 'rgba(234,179,8,0.08)', border: `1px solid rgba(234,179,8,0.2)`, borderRadius: 6, padding: 12 }}>
                        <div style={{ color: C.yellow, fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Pending Requirements</div>
                        {connectStatus?.connectStatus?.requirementsDue?.map((req: string, i: number) => (
                          <div key={i} style={{ fontSize: 12, color: C.yellow, opacity: 0.85 }}>{req}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </StepCard>
            )}

            {/* Step 5: Active Seller / Dashboard */}
            {activeStep === 4 && (
              <StepCard title="Seller Dashboard" description="You are fully onboarded. Manage your listings and view payouts." status="complete">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '14px 16px', background: 'rgba(34,197,94,0.08)', border: `1px solid rgba(34,197,94,0.2)`, borderRadius: 6 }}>
                  <Check size={18} color={C.green} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>Active Seller</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Your account is fully set up. You can submit listings and receive payouts.</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
                  <div style={{ background: C.surface2, borderRadius: 6, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Connect Status</div>
                    <div data-testid="text-connect-active" style={{ fontSize: 14, fontWeight: 700, color: C.green }}>Active</div>
                  </div>
                  <div style={{ background: C.surface2, borderRadius: 6, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Charges</div>
                    <div data-testid="text-charges-status" style={{ fontSize: 14, fontWeight: 700, color: chargesEnabled ? C.green : C.red }}>{chargesEnabled ? 'Enabled' : 'Disabled'}</div>
                  </div>
                  <div style={{ background: C.surface2, borderRadius: 6, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Payouts</div>
                    <div data-testid="text-payouts-status" style={{ fontSize: 14, fontWeight: 700, color: payoutsEnabled ? C.green : C.red }}>{payoutsEnabled ? 'Enabled' : 'Disabled'}</div>
                  </div>
                </div>

                <button data-testid="button-submit-listing" onClick={() => setLocation('/x#list')} style={{ ...btnPrimary, marginBottom: 24 }}>
                  Submit New Listing <ChevronRight size={14} />
                </button>

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>Your Listings</div>
                  {listings.length === 0 ? (
                    <div data-testid="text-no-listings" style={{ color: C.muted, fontSize: 13, padding: '12px 0' }}>No listings yet. Submit your first listing to get started.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {listings.map((l) => (
                        <div key={l.id} data-testid={`row-listing-${l.id}`} style={{ background: C.surface2, borderRadius: 6, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{l.name}</div>
                            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                              {l.standard} {l.origin ? `· ${l.origin}` : ''} {l.registrySerial ? `· ${l.registrySerial}` : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{'\u20AC'}{Number(l.pricePerTonne).toFixed(2)}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>per tonne</div>
                            </div>
                            <span data-testid={`badge-listing-status-${l.id}`} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: l.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)', color: l.status === 'active' ? C.green : C.yellow, border: `1px solid ${l.status === 'active' ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}` }}>
                              {l.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </StepCard>
            )}

            {/* Payout History — always visible once connected */}
            {hasConnectAccount && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, marginTop: 20 }}>
                <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>Payout History</div>
                {!connectStatus?.payoutHistory?.length ? (
                  <div data-testid="text-no-payouts" style={{ color: C.muted, fontSize: 13 }}>No payouts yet. Payouts appear here once trades settle.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {connectStatus.payoutHistory.map((p: PayoutRow) => (
                      <div key={p.id} data-testid={`row-payout-${p.id}`}
                        style={{ background: C.surface2, borderRadius: 6, padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                        <div>
                          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Trade {p.trade_id}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{'\u20AC'}{Number(p.seller_net_eur).toLocaleString()}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                            Gross: {'\u20AC'}{Number(p.gross_eur).toFixed(2)} · Fee: {'\u20AC'}{Number(p.fee_eur).toFixed(2)} · Provider: {p.payout_provider}
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
            )}
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

function StepCard({ title, description, status, children }: { title: string; description: string; status: StepStatus; children: React.ReactNode }) {
  const borderColor = status === 'complete' ? C.green : status === 'in_progress' ? C.gold : C.border;
  return (
    <div data-testid={`card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} style={{ background: C.surface, border: `1px solid ${borderColor}`, borderRadius: 8, padding: 28, marginBottom: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4, marginTop: 0 }}>{title}</h2>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 20, marginTop: 0 }}>{description}</p>
      {children}
    </div>
  );
}

function KybForm({
  kybLegalName, setKybLegalName,
  kybTradingName, setKybTradingName,
  kybSellerType, setKybSellerType,
  kybCountry, setKybCountry,
  kybRegistryName, setKybRegistryName,
  kybRegistryAccountId, setKybRegistryAccountId,
  kybWebsite, setKybWebsite,
  kybTaxId, setKybTaxId,
  onSubmit, loading,
}: {
  kybLegalName: string; setKybLegalName: (v: string) => void;
  kybTradingName: string; setKybTradingName: (v: string) => void;
  kybSellerType: string; setKybSellerType: (v: string) => void;
  kybCountry: string; setKybCountry: (v: string) => void;
  kybRegistryName: string; setKybRegistryName: (v: string) => void;
  kybRegistryAccountId: string; setKybRegistryAccountId: (v: string) => void;
  kybWebsite: string; setKybWebsite: (v: string) => void;
  kybTaxId: string; setKybTaxId: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={fieldGroup}>
          <label style={fieldLabel}>Legal Entity Name *</label>
          <input data-testid="input-kyb-legal-name" style={fieldInput} type="text" placeholder="e.g. Carbon Solutions Ltd." value={kybLegalName} onChange={e => setKybLegalName(e.target.value)} />
        </div>
        <div style={fieldGroup}>
          <label style={fieldLabel}>Trading Name</label>
          <input data-testid="input-kyb-trading-name" style={fieldInput} type="text" placeholder="DBA or brand name" value={kybTradingName} onChange={e => setKybTradingName(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={fieldGroup}>
          <label style={fieldLabel}>Business Type *</label>
          <select data-testid="select-kyb-seller-type" style={fieldInput} value={kybSellerType} onChange={e => setKybSellerType(e.target.value)}>
            <option value="corporate">Corporate</option>
            <option value="individual">Individual</option>
            <option value="cooperative">Cooperative</option>
            <option value="government">Government Entity</option>
          </select>
        </div>
        <div style={fieldGroup}>
          <label style={fieldLabel}>Country / Jurisdiction</label>
          <input data-testid="input-kyb-country" style={fieldInput} type="text" placeholder="e.g. Antigua & Barbuda" value={kybCountry} onChange={e => setKybCountry(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={fieldGroup}>
          <label style={fieldLabel}>Registry Name *</label>
          <select data-testid="select-kyb-registry-name" style={fieldInput} value={kybRegistryName} onChange={e => setKybRegistryName(e.target.value)}>
            <option value="">Select registry...</option>
            <option value="Verra">Verra (VCS)</option>
            <option value="Gold Standard">Gold Standard</option>
            <option value="EU ETS">EU ETS</option>
            <option value="ACR">American Carbon Registry (ACR)</option>
            <option value="CAR">Climate Action Reserve (CAR)</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div style={fieldGroup}>
          <label style={fieldLabel}>Registry Account ID *</label>
          <input data-testid="input-kyb-registry-account-id" style={fieldInput} type="text" placeholder="Your registry account ID" value={kybRegistryAccountId} onChange={e => setKybRegistryAccountId(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={fieldGroup}>
          <label style={fieldLabel}>Website</label>
          <input data-testid="input-kyb-website" style={fieldInput} type="url" placeholder="https://yourcompany.com" value={kybWebsite} onChange={e => setKybWebsite(e.target.value)} />
        </div>
        <div style={fieldGroup}>
          <label style={fieldLabel}>Tax ID / Registration Number</label>
          <input data-testid="input-kyb-tax-id" style={fieldInput} type="text" placeholder="Company registration number" value={kybTaxId} onChange={e => setKybTaxId(e.target.value)} />
        </div>
      </div>
      <button data-testid="button-kyb-submit" onClick={onSubmit} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1, marginTop: 8 }}>
        {loading ? <><Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} /> Submitting...</> : <>Submit Business Verification <ChevronRight size={14} /></>}
      </button>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: C.gold, color: '#060810', border: 'none', borderRadius: 6,
  padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14,
  display: 'inline-flex', alignItems: 'center', gap: 8,
};

const btnOutline: React.CSSProperties = {
  background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold,
  borderRadius: 6, padding: '8px 20px', cursor: 'pointer', fontSize: 13,
  display: 'inline-flex', alignItems: 'center', gap: 6,
};

const fieldGroup: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const fieldLabel: React.CSSProperties = { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' };
const fieldInput: React.CSSProperties = {
  background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6,
  padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none',
  width: '100%', boxSizing: 'border-box',
};
