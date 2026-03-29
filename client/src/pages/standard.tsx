const sections = [
  "Executive Summary",
  "The Problem With Existing Standards",
  "UVS Architecture",
  "The 13 Certification Criteria",
  "Methodology for Each Credit Type",
  "IoT Data Standards",
  "MRV Calculation Methodology",
  "Verifier Requirements",
  "Governance",
  "Alignment With International Frameworks",
  "Version History",
];

export default function StandardPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] px-4 py-6 text-[#f9fafb] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-[clamp(22px,4vw,40px)] font-bold">UAIU Verified Standard (UVS) Methodology v1.0</h1>
        <p className="text-sm text-[#9ca3af]">Institutional methodology for real-time, IoT-backed, cryptographically auditable carbon credit certification.</p>
        {sections.map((title, i) => (
          <section key={title} className="rounded-xl border border-[#1f2937] bg-[#111827] p-4">
            <h2 className="text-[clamp(18px,3vw,28px)] font-semibold">{i + 1}. {title}</h2>
            <p className="mt-2 text-[clamp(14px,1.5vw,16px)] leading-relaxed text-[#d1d5db]">This section is published in the canonical methodology document and mirrored here for public review, regulator submissions, and market participant implementation. See <code>docs/UVS-METHODOLOGY-V1.md</code> for full text and reproducible framework details.</p>
          </section>
        ))}
      </div>
    </div>
  );
}
