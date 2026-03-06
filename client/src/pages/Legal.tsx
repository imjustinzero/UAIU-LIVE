import { useState } from "react";

const sections = [
  {
    id: "tos",
    title: "Terms of Service",
    content: `UAIU Holdings Corp. ("UAIU", "we", "us") operates UAIU.LIVE/X as an institutional carbon credit execution platform.

Parties: UAIU Holdings Corp., a Wyoming C-Corp, and authorized institutional participants ("Participant").

Scope: These terms govern access to the platform, listing, procurement, execution, settlement, retirement, audit artifact generation, and all associated services.

Core terms:
• Access is restricted to authorized institutional or approved participants. Retail access is not offered.
• KYC / AML verification may be required before trading or settlement. Incomplete verification suspends trading rights.
• Carbon credits and listings are subject to verification workflows. UAIU does not guarantee registry acceptance or retirement eligibility.
• Platform fees are disclosed at execution. No hidden charges apply.
• The service may be suspended for security, legal, or operational reasons at UAIU's sole discretion with reasonable notice where practicable.
• Settlement is final upon completion of the escrow release process. Disputes must be raised within 5 business days of settlement.
• UAIU holds no beneficial interest in carbon credits listed on the platform.

Governing law: Wyoming, USA. Arbitration via JAMS (San Francisco). English language prevails.

These terms are subject to update. Continued use after notice constitutes acceptance.`,
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    content: `UAIU Holdings Corp. collects and processes data to operate the UAIU.LIVE/X platform.

Data collected: Account registration details, trade and transaction records, KYC / AML documentation, communications, and platform usage logs.

Use: Data is used to provide and improve services, verify identity and eligibility, fulfil legal obligations, prevent fraud, and communicate platform updates.

Retention: Account data is retained for the duration of the account plus 7 years for regulatory compliance. KYC records are retained as required by applicable AML law.

Security: Data is encrypted in transit (TLS) and at rest. Access is role-restricted. Security incidents are disclosed per our Security Contact policy.

Lawful basis: Contract performance, legal obligation, and legitimate interest.

Sharing: Data is shared with Stripe (payment processing), Daily.co (video sessions), and registry counterparties as required for settlement. Data is not sold.

Rights: Participants may request access, correction, or deletion of personal data subject to regulatory retention requirements.

Contact: info@uaiu.live`,
  },
  {
    id: "risk",
    title: "Risk Disclosure",
    content: `Carbon credit trading involves material risks. Participants should read this disclosure carefully before trading.

Regulatory risk: Carbon market frameworks are evolving. Credits accepted under one framework may become ineligible under another. Regulatory changes may affect the value, transferability, or retirement eligibility of credits.

Liquidity risk: Carbon credit markets can be illiquid. Bid-ask spreads may be wide. Settlement counterparties may not always be available at desired prices or volumes.

Verification risk: Credit quality depends on underlying project integrity and registry validation. Post-issuance findings may impair credit value or retirement eligibility.

Registry risk: Registry outages, policy changes, or account suspensions may delay or prevent transfer or retirement.

Counterparty risk: UAIU maintains escrow controls, but settlement finality depends on counterparty performance and Stripe payment processing.

Price risk: Carbon credit prices may change materially between trade agreement and settlement. Futures and forward hedging are not currently offered on this platform.

Jurisdiction risk: Eligibility to trade, hold, or retire carbon credits may depend on your jurisdiction and applicable regulatory framework. Participants are responsible for their own compliance.

Past performance of any listed standard or project type does not guarantee future results.

This disclosure does not constitute legal or financial advice. Participants should seek independent professional advice.`,
  },
  {
    id: "trading",
    title: "Trading Terms",
    content: `These Trading Terms supplement the Terms of Service and govern all order activity on UAIU.LIVE/X.

Order submission: RFQs (Requests for Quote) are submitted through the platform interface or API. All RFQs are non-binding until matched and confirmed.

Price authority: UAIU's live price feed is indicative. Binding prices are set at execution, subject to available liquidity and seller acceptance.

Matching: RFQ auto-match runs against active listings that meet standard, volume, and price criteria. Partial fills are supported.

Settlement path: Spot trades settle via Stripe escrow. Funds are held until delivery confirmation and retirement record are verified. Escrow is released upon satisfactory settlement.

Retirement finality: Once a retirement certificate is issued, the transaction is irrevocable. No cancellations or reversals are possible.

Dispute window: Settlement disputes must be raised within 5 business days of the confirmed settlement date by emailing operations@uaiu.live with the Trade ID.

Exception handling: Trades flagged by the exception queue are placed on hold pending operator review. UAIU will notify the participant within 2 business days.

Fees: Platform fees are deducted at settlement and disclosed at execution. Fees are non-refundable once settlement completes.`,
  },
  {
    id: "kyc",
    title: "KYC / AML Policy Summary",
    content: `UAIU Holdings Corp. applies a risk-based KYC / AML framework in accordance with applicable US financial regulations.

Onboarding checks: All participants complete identity verification (individual KYC or entity KYB) before trading. Verification is provided by Stripe Identity and supplemented by document review.

Sanctions screening: Participants and beneficial owners are screened against OFAC, EU, and UN sanctions lists at onboarding and on an ongoing basis.

Source of funds: Participants may be required to disclose the source of funds for large or unusual transactions. Failure to provide satisfactory documentation may result in account suspension.

Suspicious activity: UAIU monitors for transaction patterns indicative of money laundering, fraud, or sanctions evasion. Suspicious activity is reported to relevant authorities as required by law.

Account restriction: UAIU reserves the right to restrict, suspend, or terminate accounts where KYC/AML concerns are identified. Decisions are subject to internal review.

Data retention: KYC/AML records are retained for a minimum of 5 years following account closure in accordance with FinCEN guidance.

Questions: compliance@uaiu.live`,
  },
  {
    id: "security",
    title: "Incident & Security Contact",
    content: `UAIU maintains a responsible disclosure and incident response programme.

Security reports: To report a vulnerability or suspected breach, email info@uaiu.live with subject "SECURITY DISCLOSURE". Include a description of the issue, steps to reproduce, and any supporting evidence. We do not pursue legal action against good-faith reporters.

Incident escalation: For urgent operational incidents (trading halt, funds at risk, data breach), contact operations@uaiu.live.

Response targets:
• Initial acknowledgement: within 24 hours
• Status update: within 72 hours
• Resolution or workaround: within 14 days (severity dependent)

Platform status: Real-time status is available at /status. Planned maintenance is announced at least 48 hours in advance.`,
  },
  {
    id: "company",
    title: "Company Details & Jurisdiction",
    content: `UAIU Holdings Corp.
Entity type: Wyoming C-Corp
Business: Institutional carbon credit procurement and execution platform

Platform: UAIU.LIVE/X
General enquiries: info@uaiu.live
Operations: operations@uaiu.live

Governing law: State of Wyoming, United States of America.
Dispute resolution: Binding arbitration via JAMS, San Francisco, CA.

Participants are responsible for determining whether use of the platform is permitted under the laws of their own jurisdiction.`,
  },
];

const C = {
  bg: '#060810',
  surface: '#0d1220',
  border: 'rgba(212,168,67,0.2)',
  gold: '#d4a843',
  text: '#f2ead8',
  muted: '#8fa3b1',
};

export default function LegalPage() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '48px 20px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ marginBottom: 8, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.gold }}>
          UAIU.LIVE/X
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Legal & Compliance</h1>
        <p style={{ fontSize: 14, color: C.muted, marginBottom: 40, lineHeight: 1.6 }}>
          This page provides the institutional legal framework for UAIU.LIVE/X participants. All sections are subject to review by qualified legal counsel before execution.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sections.map(s => (
            <div
              key={s.id}
              style={{ border: `1px solid ${C.border}`, background: C.surface, borderRadius: 6, overflow: 'hidden' }}
            >
              <button
                data-testid={`button-legal-${s.id}`}
                onClick={() => setOpen(prev => prev === s.id ? null : s.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '18px 24px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  color: C.text,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600 }}>{s.title}</span>
                <span style={{ color: C.gold, fontSize: 18, lineHeight: 1 }}>{open === s.id ? '−' : '+'}</span>
              </button>
              {open === s.id && (
                <div style={{ padding: '0 24px 24px', fontSize: 13, color: C.muted, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                  {s.content}
                </div>
              )}
            </div>
          ))}
        </div>

        <p style={{ marginTop: 40, fontSize: 12, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
          Last reviewed: March 2026. For questions contact info@uaiu.live.
          These documents require review by qualified legal counsel before use in binding agreements.
        </p>
      </div>
    </main>
  );
}
