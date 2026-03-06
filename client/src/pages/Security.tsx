export default function SecurityPage() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 20px', color: '#e2e8f0' }}>
      <h1>Security</h1>
      <p>UAIU.LIVE/X is designed for institutional carbon procurement and execution with route-level authentication, audit artifacts, escrow-grade settlement controls, admin header authorization, CSP protection, KYC-gated execution, and tamper-evident trade records.</p>
      <h2>Controls</h2>
      <ul>
        <li>Token-based exchange authentication</li>
        <li>Protected trading, retirement, and admin routes</li>
        <li>Server-authoritative pricing and KYC enforcement</li>
        <li>Webhook idempotency and security logging</li>
        <li>Helmet/CSP and sanitized error handling</li>
      </ul>
      <h2>Contact</h2>
      <p>Security contact: info@uaiu.live</p>
    </main>
  );
}
