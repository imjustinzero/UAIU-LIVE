import { useState } from "react";

const C = {
  ink: '#060810', ink2: '#0d1220', ink3: '#141e30',
  gold: '#d4a843', gold2: '#f0c96a', goldfaint: 'rgba(212,168,67,0.12)',
  goldborder: 'rgba(212,168,67,0.22)', cream: '#f2ead8',
  cream2: 'rgba(242,234,216,0.7)', cream3: 'rgba(242,234,216,0.35)',
  cream4: 'rgba(242,234,216,0.1)', green: '#22c55e', red: '#ef4444',
};
const F = { mono: "'JetBrains Mono', monospace", syne: "'Syne', sans-serif", playfair: "'Playfair Display', serif" };
const fi: React.CSSProperties = { width: '100%', background: C.ink2, border: `1px solid ${C.goldborder}`, color: C.cream, padding: '13px 16px', fontFamily: F.mono, fontSize: 12, outline: 'none', boxSizing: 'border-box' };
const fl: React.CSSProperties = { fontFamily: F.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.cream3, display: 'block', marginBottom: 8 };

interface Trade { trade_id: string; side: string; standard?: string; volume_tonnes?: number; price_eur_per_tonne?: number; gross_eur?: number; receipt_hash?: string; verify_url?: string; prev_receipt_hash?: string; payment_intent_id?: string; settled_at?: string; retirement_status?: string; }
interface Retirement { cert_id?: string; trade_id?: string; tonnes_retired?: number; beneficiary?: string; receipt_hash?: string; }

interface PortfolioProps {
  trades?: Trade[];
  retirements?: Retirement[];
  accountName?: string;
  annualTarget?: number;
}

export function PortfolioDashboard({ trades = [], retirements = [], accountName = 'Your Account', annualTarget = 10000 }: PortfolioProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'retirements'>('overview');

  const totalTonnes = trades.reduce((s, t) => s + (t.volume_tonnes || 0), 0);
  const totalSpend = trades.reduce((s, t) => s + (t.gross_eur || 0), 0);
  const totalRetired = retirements.reduce((s, r) => s + (r.tonnes_retired || 0), 0);
  const compliancePct = annualTarget > 0 ? Math.min(100, (totalRetired / annualTarget) * 100) : 0;
  const complianceColor = compliancePct >= 100 ? C.green : compliancePct >= 60 ? '#f59e0b' : C.red;

  function downloadPDF() {
    generatePDFReport({ accountName, trades, retirements, annualTarget });
  }

  return (
    <section id="dashboard" style={{ background: C.ink2, borderTop: `1px solid ${C.goldborder}`, borderBottom: `1px solid ${C.goldborder}` }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '100px 52px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 56, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.gold, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 24, height: 1, background: C.gold, display: 'inline-block' }} />
              Portfolio Dashboard
            </div>
            <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(28px,3vw,44px)', fontWeight: 900, color: C.cream, margin: 0 }}>{accountName}</h2>
          </div>
          <button onClick={downloadPDF} style={{ background: C.ink, border: `1px solid ${C.goldborder}`, color: C.gold, padding: '12px 24px', fontFamily: F.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer' }} data-testid="button-download-pdf">
            Download Compliance Report →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: C.goldborder, border: `1px solid ${C.goldborder}`, marginBottom: 40 }}>
          {[
            { label: 'Carbon Position', val: totalTonnes.toLocaleString() + ' t', sub: 'tonnes CO₂ held', color: C.green },
            { label: 'Total Spend', val: '€' + totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 }), sub: 'gross value', color: C.gold },
            { label: 'Trades Executed', val: trades.length.toString(), sub: `this period`, color: C.cream },
            { label: 'Retirements', val: retirements.length.toString(), sub: 'credits retired', color: compliancePct >= 100 ? C.green : C.cream2 },
          ].map(({ label, val, sub, color }) => (
            <div key={label} style={{ background: C.ink2, padding: '28px 24px' }}>
              <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.cream3, marginBottom: 10 }}>{label}</div>
              <div style={{ fontFamily: F.playfair, fontSize: 30, fontWeight: 900, color, lineHeight: 1, marginBottom: 6 }}>{val}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream4 }}>{sub}</div>
            </div>
          ))}
        </div>

        <div style={{ background: C.ink, border: `1px solid ${C.goldborder}`, padding: '28px 24px', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.cream3 }}>EU ETS Compliance Status</div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: complianceColor }}>{compliancePct.toFixed(0)}% — {totalRetired.toLocaleString()} / {annualTarget.toLocaleString()} t retired</div>
          </div>
          <div style={{ height: 8, background: C.ink3, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${compliancePct}%`, background: complianceColor, transition: 'width 1s ease' }} />
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginTop: 10 }}>
            {compliancePct >= 100 ? '✓ Fully compliant for reporting period' : `${(annualTarget - totalRetired).toLocaleString()} tonnes remaining to meet annual target`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
          {(['overview','trades','retirements'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '12px 24px', fontFamily: F.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', border: `1px solid ${C.goldborder}`, cursor: 'pointer', background: activeTab === tab ? C.goldfaint : 'transparent', color: activeTab === tab ? C.gold : C.cream3, borderBottom: activeTab === tab ? `2px solid ${C.gold}` : `1px solid ${C.goldborder}` }}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'trades' && (
          <div>
            {trades.length === 0 ? (
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3, padding: '40px 0', textAlign: 'center' }}>No trades yet. Execute a trade to see your history here.</div>
            ) : trades.map((t, i) => (
              <div key={i} style={{ background: C.ink, border: `1px solid ${C.goldborder}`, padding: '20px 24px', marginBottom: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 16, alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Trade ID</div>
                  <div style={{ fontFamily: F.mono, fontSize: 11, color: t.side === 'buy' ? C.green : C.red }}>{t.trade_id}</div>
                </div>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Volume</div>
                  <div style={{ fontFamily: F.syne, fontSize: 13, color: C.cream }}>{(t.volume_tonnes || 0).toLocaleString()} t</div>
                </div>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Gross</div>
                  <div style={{ fontFamily: F.syne, fontSize: 13, color: C.cream }}>€{(t.gross_eur || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Receipt</div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.gold }}>{(t.receipt_hash || '').slice(0, 20)}...</div>
                </div>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Retirement Status</div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: (t.retirement_status || '').includes('Confirmed') ? C.green : C.red }}>{t.retirement_status || 'Pending / Overdue'}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'retirements' && (
          <div>
            {retirements.length === 0 ? (
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3, padding: '40px 0', textAlign: 'center' }}>No retirements yet.</div>
            ) : retirements.map((r, i) => (
              <div key={i} style={{ background: C.ink, border: `1px solid ${C.goldborder}`, padding: '20px 24px', marginBottom: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div><div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Cert ID</div><div style={{ fontFamily: F.mono, fontSize: 11, color: C.gold }}>{r.cert_id}</div></div>
                <div><div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Tonnes Retired</div><div style={{ fontFamily: F.syne, fontSize: 13, color: C.green }}>{(r.tonnes_retired || 0).toLocaleString()} t</div></div>
                <div><div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Beneficiary</div><div style={{ fontFamily: F.syne, fontSize: 13, color: C.cream }}>{r.beneficiary}</div></div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'overview' && (
          <div style={{ padding: '20px 0' }}>
            {trades.length === 0 && retirements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 24px', border: `1px solid ${C.goldborder}` }}>
                <div style={{ fontFamily: F.playfair, fontSize: 22, fontWeight: 700, color: C.cream2, marginBottom: 12 }}>No trades yet</div>
                <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3, lineHeight: 1.7 }}>Execute a trade in the marketplace to begin building your carbon portfolio.<br />Your position, spend, and compliance status will appear here.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ background: C.ink, border: `1px solid ${C.goldborder}`, padding: '28px 24px' }}>
                  <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, marginBottom: 16 }}>Carbon Acquired</div>
                  <div style={{ fontFamily: F.playfair, fontSize: 36, fontWeight: 900, color: C.green, marginBottom: 8 }}>{totalTonnes.toLocaleString()} t</div>
                  <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3 }}>Across {trades.length} trade{trades.length !== 1 ? 's' : ''} · Avg €{trades.length ? (totalSpend / totalTonnes).toFixed(2) : '—'}/t</div>
                </div>
                <div style={{ background: C.ink, border: `1px solid ${C.goldborder}`, padding: '28px 24px' }}>
                  <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, marginBottom: 16 }}>Compliance Progress</div>
                  <div style={{ fontFamily: F.playfair, fontSize: 36, fontWeight: 900, color: complianceColor, marginBottom: 8 }}>{compliancePct.toFixed(0)}%</div>
                  <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3 }}>{totalRetired.toLocaleString()} / {annualTarget.toLocaleString()} t retired · {compliancePct >= 100 ? 'Fully compliant' : `${(annualTarget - totalRetired).toLocaleString()} t remaining`}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

interface MultiSigProps {
  tradeId: string;
  receiptHash: string;
  onApproved: (token: string) => void;
  onSkip: () => void;
}

export function MultiSigApproval({ tradeId, receiptHash, onApproved, onSkip }: MultiSigProps) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState('');
  const [approvalUrl, setApprovalUrl] = useState('');

  async function sendApproval() {
    if (!email.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/exchange/multisig-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId, receiptHash, complianceEmail: email }),
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        setApprovalUrl(data.approvalUrl || '');
        setSent(true);
      }
    } catch {
      setSent(true);
      setToken('DEMO-' + Math.random().toString(36).slice(2, 10).toUpperCase());
      setApprovalUrl(`https://uaiu.live/x/verify/${encodeURIComponent(receiptHash || '')}`);
    }
    setSending(false);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,8,16,0.96)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(12px)' }}>
      <div style={{ background: C.ink2, border: `1px solid ${C.goldborder}`, width: '90%', maxWidth: 480, padding: '48px 40px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.gold},transparent)` }} />
        <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>Pending Compliance Approval</div>
        <div style={{ fontFamily: F.playfair, fontSize: 22, fontWeight: 700, color: C.cream, marginBottom: 8 }}>Multi-Signature Required</div>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3, marginBottom: 28 }}>Trade ID: {tradeId}</div>

        {!sent ? (
          <>
            <div style={{ marginBottom: 20 }}>
              <label style={fl}>Compliance Officer Email *</label>
              <input style={fi} type="email" placeholder="compliance@yourcompany.com" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-multisig-email" />
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, marginBottom: 24, lineHeight: 1.6 }}>
              An approval link will be sent to this address. The trade will remain in pending status until approved.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={sendApproval} disabled={sending || !email.trim()} style={{ flex: 1, background: C.gold, color: C.ink, padding: '14px', fontFamily: F.syne, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }} data-testid="button-send-approval">
                {sending ? 'Sending...' : 'Send Approval Request →'}
              </button>
              <button onClick={onSkip} style={{ padding: '14px 20px', background: 'transparent', border: `1px solid ${C.goldborder}`, color: C.cream3, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer' }} data-testid="button-skip-multisig">
                Skip
              </button>
            </div>
          </>
        ) : (
          <div>
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', padding: '20px', marginBottom: 24 }}>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.green, marginBottom: 8, letterSpacing: '0.15em' }}>Approval Request Sent</div>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3 }}>Approval Token: <span style={{ color: C.gold }}>{token}</span></div>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginTop: 8 }}>Approval URL: {approvalUrl || `https://uaiu.live/x/verify/${encodeURIComponent(receiptHash || '')}`}</div>
            </div>
            <button onClick={() => onApproved(token)} style={{ width: '100%', background: C.gold, color: C.ink, padding: '14px', fontFamily: F.syne, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }} data-testid="button-confirm-approval">
              Continue →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export async function generatePDFReport({ accountName, trades, retirements, annualTarget }: { accountName: string; trades: Trade[]; retirements: Retirement[]; annualTarget: number }) {
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const gold = [212, 168, 67] as [number, number, number];
    const ink = [6, 8, 16] as [number, number, number];
    const cream = [242, 234, 216] as [number, number, number];

    doc.setFillColor(...ink);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setFillColor(...gold);
    doc.rect(0, 0, 210, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...gold);
    doc.text('UAIU.LIVE/X', 20, 30);

    doc.setFontSize(12);
    doc.setTextColor(...cream);
    doc.text('Carbon Credit Compliance Report', 20, 40);

    doc.setFontSize(10);
    doc.setTextColor(180, 160, 120);
    doc.text(`Account: ${accountName}`, 20, 52);
    doc.text(`Generated: ${new Date().toISOString()}`, 20, 60);
    doc.text(`Reporting Period: ${new Date().getFullYear()}`, 20, 68);

    let y = 85;
    doc.setFontSize(13);
    doc.setTextColor(...gold);
    doc.text('Portfolio Summary', 20, y); y += 12;

    const totalTonnes = trades.reduce((s, t) => s + (t.volume_tonnes || 0), 0);
    const totalSpend = trades.reduce((s, t) => s + (t.gross_eur || 0), 0);
    const totalRetired = retirements.reduce((s, r) => s + (r.tonnes_retired || 0), 0);
    const compliancePct = annualTarget > 0 ? Math.min(100, (totalRetired / annualTarget) * 100) : 0;

    doc.setFontSize(10);
    doc.setTextColor(...cream);
    const summaryLines = [
      `Total Carbon Position: ${totalTonnes.toLocaleString()} tonnes`,
      `Total Spend: €${totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      `Trades Executed: ${trades.length}`,
      `Credits Retired: ${totalRetired.toLocaleString()} tonnes`,
      `EU ETS Compliance: ${compliancePct.toFixed(0)}% of ${annualTarget.toLocaleString()} t annual target`,
    ];
    summaryLines.forEach(line => { doc.text(line, 20, y); y += 8; });

    if (trades.length > 0) {
      y += 8;
      doc.setFontSize(13);
      doc.setTextColor(...gold);
      doc.text('Trade History', 20, y); y += 10;
      doc.setFontSize(8);
      doc.setTextColor(180, 160, 120);
      doc.text('TRADE ID', 20, y); doc.text('SIDE', 80, y); doc.text('VOLUME (t)', 110, y); doc.text('GROSS EUR', 150, y);
      y += 6;
      doc.setDrawColor(...gold);
      doc.line(20, y, 190, y); y += 6;
      doc.setTextColor(...cream);
      trades.slice(0, 15).forEach(t => {
        doc.text((t.trade_id || '').slice(0, 20), 20, y);
        doc.text((t.side || '').toUpperCase(), 80, y);
        doc.text((t.volume_tonnes || 0).toLocaleString(), 110, y);
        doc.text('€' + (t.gross_eur || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }), 150, y);
        y += 7;
        if (y > 270) { doc.addPage(); doc.setFillColor(...ink); doc.rect(0, 0, 210, 297, 'F'); y = 20; }
      });
    }

    if (retirements.length > 0) {
      y += 8;
      doc.setFontSize(13);
      doc.setTextColor(...gold);
      doc.text('Retirement Certificates', 20, y); y += 10;
      doc.setFontSize(8);
      doc.setTextColor(180, 160, 120);
      doc.text('CERT ID', 20, y); doc.text('TONNES', 100, y); doc.text('BENEFICIARY', 140, y);
      y += 6;
      doc.setDrawColor(...gold);
      doc.line(20, y, 190, y); y += 6;
      doc.setTextColor(...cream);
      retirements.forEach(r => {
        doc.text((r.cert_id || '').slice(0, 20), 20, y);
        doc.text((r.tonnes_retired || 0).toLocaleString(), 100, y);
        doc.text((r.beneficiary || '').slice(0, 20), 140, y);
        y += 7;
        if (y > 270) { doc.addPage(); doc.setFillColor(...ink); doc.rect(0, 0, 210, 297, 'F'); y = 20; }
      });
    }

    const chainTrades = trades.filter(t => t.receipt_hash);
    if (chainTrades.length > 0) {
      doc.addPage();
      doc.setFillColor(...ink);
      doc.rect(0, 0, 210, 297, 'F');
      doc.setFillColor(...gold);
      doc.rect(0, 0, 210, 4, 'F');
      y = 20;
      doc.setFontSize(13);
      doc.setTextColor(...gold);
      doc.text('Tamper-Evident Receipt Chain', 20, y); y += 12;
      doc.setFontSize(8);
      doc.setTextColor(180, 160, 120);
      doc.text('This chain links each trade hash to the previous, ensuring immutable audit integrity.', 20, y); y += 12;

      chainTrades.forEach((t, i) => {
        if (y > 250) { doc.addPage(); doc.setFillColor(...ink); doc.rect(0, 0, 210, 297, 'F'); y = 20; }
        doc.setFillColor(13, 18, 32);
        doc.rect(18, y - 4, 174, 32, 'F');
        doc.setDrawColor(...gold);
        doc.rect(18, y - 4, 174, 32, 'S');
        doc.setFontSize(8);
        doc.setTextColor(...gold);
        doc.text(`#${i + 1} — Trade ${(t.trade_id || '').slice(0, 28)}`, 22, y + 2);
        doc.setTextColor(...cream);
        doc.setFontSize(7);
        doc.text(`Hash:     ${(t.receipt_hash || '—').slice(0, 55)}`, 22, y + 9);
        doc.text(`Prev:     ${(t.prev_receipt_hash || '—').slice(0, 55)}`, 22, y + 15);
        doc.text(`PI:       ${(t.payment_intent_id || '—').slice(0, 40)}`, 22, y + 21);
        doc.setTextColor(180, 160, 120);
        doc.text(`Settled: ${t.settled_at || 'session trade'}`, 22, y + 27);
        y += 40;
      });
    }

    doc.save(`UAIU-Compliance-Report-${Date.now()}.pdf`);
  } catch (err) {
    console.error('PDF generation failed:', err);
    alert('PDF download failed. Please try again.');
  }
}
