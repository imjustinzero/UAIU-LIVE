const sections = [
  'Terms of Service',
  'Privacy Policy',
  'Risk Disclosure',
  'Trading Terms',
  'KYC / AML Policy Summary',
  'Incident & Security Contact',
  'Company Details & Jurisdiction',
];

export default function LegalPage() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 20px', color: '#e2e8f0' }}>
      <h1>Legal & Compliance</h1>
      <p>This page is a launch-ready legal index for institutional counterparties.</p>
      <ul>
        {sections.map(s => <li key={s}>{s}</li>)}
      </ul>
      <p>Use the markdown templates in `/docs/legal` from this pack to populate the final published versions.</p>
    </main>
  );
}
