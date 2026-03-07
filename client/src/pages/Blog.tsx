import { Link } from "wouter";
import { jsPDF } from "jspdf";
import { useSEO } from "@/lib/seo";

const C = {
  ink: '#060810',
  ink2: '#0d1220',
  ink3: '#141b2d',
  gold: '#d4a843',
  goldborder: 'rgba(212,168,67,0.22)',
  cream: '#f2ead8',
  cream2: 'rgba(242,234,216,0.75)',
  cream3: 'rgba(242,234,216,0.45)',
};

const ARTICLE = {
  kicker: 'UAIU HOLDINGS  •  CARBON MARKETS & CLIMATE COMPLIANCE  •  2026',
  title: 'Carbon Markets Are Entering a New Era of Proof',
  subtitle: 'Why buyers in shipping, aviation, government, and ESG are moving away from broker promises and toward verifiable trade infrastructure',
  byline: 'By UAIU Editorial  •  uaiu.live/x',
  sections: [
    {
      body: [
        'For years, the carbon market has had a trust problem.',
        'Buyers have relied on fragmented registries, manual broker processes, disconnected spreadsheets, and limited post-trade visibility. In that environment, companies could say they had offset emissions, but proving exactly what they bought, when they bought it, where it came from, and whether it matched a compliance or reporting need was often far harder than it should have been.',
        'That is changing.',
        'As climate reporting rules tighten and carbon procurement becomes more visible to regulators, auditors, investors, and the public, the market is shifting away from relationship-based brokerage and toward systems built for verification, traceability, and execution discipline. The next phase of carbon trading will not be defined by marketing language. It will be defined by evidence.',
        'UAIU Holdings, a Wyoming C-Corp operating UAIU.LIVE/X, is positioning itself inside that shift with what it describes as an execution layer for carbon markets: a live platform built around cryptographic trade records, escrow-based settlement, and AI-assisted due diligence. The pitch is simple: if a carbon trade matters financially or regulatorily, buyers should be able to prove it.',
      ]
    },
    {
      heading: 'Why proof matters now',
      body: [
        'Carbon procurement is no longer a side conversation inside sustainability departments. It is moving into finance, legal, operations, and board-level risk management.',
        'That is especially true in sectors such as maritime shipping, aviation, public sector procurement, and enterprise ESG reporting, where carbon exposure can affect cost, disclosure obligations, and reputational risk. Buyers are asking harder questions than they did even a few years ago:',
      ],
      bullets: [
        'What exactly are we buying?',
        'Which project and registry does it come from?',
        'Can we verify chain of custody?',
        'Can we document the purchase for audit, disclosure, or review?',
        'Can procurement teams act fast without increasing compliance risk?',
      ],
      bodyAfter: [
        'Those questions are reshaping the market. The old model of broker emails, PDF attachments, and off-platform confirmations is becoming harder to defend in a world that increasingly expects documented evidence.',
      ]
    },
    {
      heading: 'From broker trust to trade evidence',
      pullQuote: 'The future of carbon markets may belong to platforms that can produce evidence, not just access.',
      body: [
        'The most important shift may be structural, not rhetorical.',
        'Traditional carbon transactions have often depended on counterparties, intermediaries, and manual confirmation processes. That can work in a relationship-driven market, but it creates friction for institutions that need a cleaner record of what happened.',
        'UAIU.LIVE/X attempts to solve that by generating a SHA-256 hashed receipt chain for each executed trade. In practical terms, that means each transaction produces a tamper-evident record linked to the underlying trade details.',
        'For buyers, the value is straightforward. A trade is not just "completed"; it is documented in a way designed to be retained, reviewed, and referenced later. In a market where the credibility of a carbon claim can depend on documentation quality, that kind of record may matter as much as price.',
      ]
    },
    {
      heading: 'The carbon market is becoming operational',
      body: [
        'Another change is happening at the workflow level.',
        'Carbon buying has historically been treated as a specialty activity handled by a small number of internal experts or outside brokers. But as emissions exposure, voluntary commitments, and disclosure expectations expand, procurement is starting to look more like an operational function.',
        'That means buyers want the same things they expect in other markets: clear execution, clear fees, clear settlement, clear records, and faster internal review.',
        'UAIU says its platform uses escrow infrastructure through Stripe Connect and releases funds on a T+1 basis after verification and delivery conditions are met. Whether buyers approach the market from a corporate treasury, sustainability, shipping, or aviation context, that model speaks to a broader demand: less ambiguity and fewer points of manual risk.',
      ]
    },
    {
      heading: 'Where AI fits',
      body: [
        'Artificial intelligence in carbon markets is often discussed too vaguely. The real question is not whether AI is involved, but whether it reduces workload and improves decision quality.',
        'According to UAIU, its AI co-pilots are designed to support credit review and procurement decisions by generating structured due diligence outputs, monitoring portfolio conditions, and alerting buyers before deadlines or budget overruns become more serious. That is a more useful framing than generic "AI-powered" language because it ties the technology to specific procurement tasks.',
        'In practice, the carbon market has become too complex for most teams to manage through manual review alone. Buyers now need help comparing project quality, registry details, timing, pricing, and fit for a given use case. AI may become valuable not as a buzzword, but as a practical layer that helps teams move faster without losing control.',
      ]
    },
    {
      heading: 'Who is likely to care',
      body: [
        'This kind of infrastructure is most relevant to organizations that treat carbon as a real operating line item rather than a branding exercise.',
        'Shipping companies preparing for emissions-related purchasing and reporting demands. Air carriers managing offset and compliance obligations across complex operating schedules. Corporate sustainability and finance teams that need stronger documentation around carbon activity. Cities and public agencies seeking a more defensible procurement trail for climate commitments.',
        'Across those categories, the underlying need is the same: if carbon purchases will be reviewed by auditors, regulators, internal stakeholders, or the public, then the market needs systems that produce records people can actually trust.',
      ]
    },
    {
      heading: 'A more mature market is coming',
      body: [
        'The carbon market does not need more slogans. It needs infrastructure.',
        'That is what makes this moment important. The industry appears to be moving away from a period defined by loose claims, unclear pricing, and inconsistent records, and toward one defined by execution quality, verifiability, and audit readiness.',
        'If that trend continues, the winners in carbon markets will not simply be the firms with the biggest networks or the loudest messaging. They will be the ones that make carbon procurement easier to document, easier to defend, and easier to integrate into real-world financial and compliance workflows.',
        'In that sense, the next chapter of the carbon market may be less about offsets as a concept and more about execution as a standard.',
        'And once buyers begin to expect proof by default, there is usually no going back.',
      ]
    },
  ],
  faqs: [
    { q: 'What is UAIU.LIVE/X?', a: 'UAIU.LIVE/X is a carbon market trading platform operated by UAIU Holdings, built for execution, verification, and settlement of carbon credits.' },
    { q: 'What problem does UAIU solve in carbon markets?', a: 'It addresses traceability, fragmented broker workflows, and weak post-trade documentation by providing cryptographic trade records and escrow-based settlement.' },
    { q: 'Who uses carbon market execution platforms?', a: 'Shipping companies, airlines, ESG teams, corporate buyers, city governments, and public agencies with carbon procurement or compliance obligations.' },
    { q: 'What is a SHA-256 receipt chain?', a: 'It is a tamper-evident cryptographic record used to document trade activity at the point of execution, designed to support verification, audit, and disclosure workflows.' },
    { q: 'Why does carbon trade verification matter?', a: 'Verified records can support audit, disclosure, and compliance workflows as carbon procurement becomes subject to greater regulatory and investor scrutiny.' },
    { q: 'How is UAIU different from a carbon broker?', a: 'UAIU positions itself as execution infrastructure rather than a relationship-based brokerage layer, with published fees, escrow settlement, and cryptographic trade records.' },
    { q: 'What role does AI play in carbon credit due diligence?', a: 'AI can help review project details, organize risk information, monitor portfolio conditions, and support faster procurement decisions without manual review bottlenecks.' },
    { q: 'Where is UAIU Holdings based?', a: 'UAIU Holdings is structured as a Wyoming C-Corp.' },
  ],
  about: 'UAIU Holdings is a Wyoming C-Corp operating UAIU.LIVE/X, a live carbon market platform focused on trade execution, verification, and settlement infrastructure for institutional and corporate buyers.',
  reproduction: 'This editorial may be reproduced with attribution to UAIU Holdings and a link to uaiu.live/x.',
};

function downloadPDF() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 20;
  const maxW = pageW - margin * 2;
  let y = 20;

  const line = (text: string, size: number, color: [number, number, number], bold = false, italic = false) => {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.setFont('helvetica', bold ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal'));
    const lines = doc.splitTextToSize(text, maxW);
    lines.forEach((l: string) => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(l, margin, y);
      y += size * 0.45;
    });
    y += 2;
  };

  const gap = (mm = 4) => { y += mm; };

  line(ARTICLE.kicker, 7, [140, 100, 30], false);
  gap(2);
  line(ARTICLE.title, 18, [20, 20, 20], true);
  gap(2);
  line(ARTICLE.subtitle, 10, [80, 80, 80], false, true);
  gap(1);
  line(ARTICLE.byline, 8, [120, 120, 120]);
  gap(4);

  doc.setDrawColor(212, 168, 67);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  gap(6);

  ARTICLE.sections.forEach(s => {
    if (s.heading) {
      line(s.heading, 13, [20, 20, 20], true);
      gap(1);
    }
    if (s.pullQuote) {
      line(`"${s.pullQuote}"`, 10, [140, 100, 30], false, true);
      gap(2);
    }
    s.body?.forEach(p => { line(p, 9.5, [40, 40, 40]); gap(1); });
    s.bullets?.forEach(b => { line(`  •  ${b}`, 9.5, [40, 40, 40]); });
    s.bodyAfter?.forEach(p => { line(p, 9.5, [40, 40, 40]); gap(1); });
    gap(3);
  });

  gap(2);
  doc.setDrawColor(212, 168, 67);
  doc.line(margin, y, pageW - margin, y);
  gap(6);
  line('Frequently Asked Questions', 13, [20, 20, 20], true);
  gap(3);

  ARTICLE.faqs.forEach(f => {
    line(f.q, 9.5, [20, 20, 20], true);
    line(f.a, 9.5, [60, 60, 60]);
    gap(3);
  });

  gap(2);
  doc.setDrawColor(212, 168, 67);
  doc.line(margin, y, pageW - margin, y);
  gap(6);
  line('About UAIU Holdings', 11, [20, 20, 20], true);
  line(ARTICLE.about, 9.5, [60, 60, 60]);
  gap(2);
  line('Platform: uaiu.live/x', 9, [140, 100, 30]);
  gap(2);
  line(ARTICLE.reproduction, 8, [100, 100, 100], false, true);

  doc.save('UAIU_Carbon_Editorial_2026.pdf');
}

const ARTICLE_DATE = "2026-03-07";
const ARTICLE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Carbon Markets Are Entering a New Era of Proof",
  "description": "Why buyers in shipping, aviation, government, and ESG are moving away from broker promises and toward verifiable trade infrastructure",
  "author": {
    "@type": "Organization",
    "name": "UAIU Holdings Corp",
  },
  "publisher": {
    "@type": "Organization",
    "name": "UAIU Holdings Corp",
    "url": "https://uaiu.live",
  },
  "datePublished": ARTICLE_DATE,
  "dateModified": ARTICLE_DATE,
  "url": "https://uaiu.live/blog",
};

export default function Blog() {
  useSEO({
    title: 'Carbon Markets Are Entering a New Era of Proof',
    description: 'Carbon market insights, EU ETS compliance updates, Verra VCS registration guides, and institutional procurement news from UAIU Holdings.',
    path: '/blog',
    ogType: 'article',
    jsonLd: ARTICLE_SCHEMA,
  });
  return (
    <div style={{ minHeight: '100vh', background: C.ink, color: C.cream, fontFamily: "'Syne', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .blog-body p { margin: 0 0 18px; }
        .blog-body ul { margin: 0 0 18px; padding: 0; list-style: none; }
        .blog-body ul li { padding: 4px 0 4px 20px; position: relative; }
        .blog-body ul li::before { content: '•'; position: absolute; left: 0; color: ${C.gold}; }
      `}</style>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 24px 80px' }}>

        <div style={{ padding: '32px 0 24px', borderBottom: `1px solid ${C.goldborder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/x" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.gold, textDecoration: 'none', letterSpacing: '0.12em' }}>
            ← UAIU.LIVE/X
          </Link>
          <button
            data-testid="button-download-pdf"
            onClick={downloadPDF}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              background: 'transparent',
              border: `1px solid ${C.goldborder}`,
              color: C.gold,
              padding: '8px 18px',
              cursor: 'pointer',
              transition: 'border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,168,67,0.08)'; (e.currentTarget as HTMLButtonElement).style.borderColor = C.gold; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = C.goldborder; }}
          >
            Download PDF Editorial
          </button>
        </div>

        <div style={{ padding: '48px 0 36px' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, marginBottom: 20 }}>
            {ARTICLE.kicker}
          </div>
          <h1 style={{ margin: '0 0 16px', fontFamily: "'Playfair Display', serif", fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 700, color: C.cream, lineHeight: 1.2 }}>
            {ARTICLE.title}
          </h1>
          <p style={{ margin: '0 0 20px', fontFamily: "'Playfair Display', serif", fontSize: 'clamp(15px, 2.5vw, 18px)', fontStyle: 'italic', color: C.cream2, lineHeight: 1.6 }}>
            {ARTICLE.subtitle}
          </p>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.cream3, letterSpacing: '0.06em' }}>
            {ARTICLE.byline}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.goldborder}`, marginBottom: 48 }} />

        <div className="blog-body" style={{ fontSize: 'clamp(15px, 2vw, 17px)', lineHeight: 1.8, color: C.cream2 }}>
          {ARTICLE.sections.map((s, i) => (
            <div key={i} style={{ marginBottom: 40 }}>
              {s.heading && (
                <h2 style={{ margin: '0 0 20px', fontFamily: "'Playfair Display', serif", fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 700, color: C.cream, lineHeight: 1.3 }}>
                  {s.heading}
                </h2>
              )}
              {s.pullQuote && (
                <blockquote style={{ margin: '0 0 28px', padding: '20px 24px', borderLeft: `3px solid ${C.gold}`, background: 'rgba(212,168,67,0.05)', fontFamily: "'Playfair Display', serif", fontSize: 'clamp(16px, 2.2vw, 19px)', fontStyle: 'italic', color: C.cream, lineHeight: 1.6 }}>
                  {s.pullQuote}
                </blockquote>
              )}
              {s.body?.map((p, j) => <p key={j} style={{ margin: '0 0 18px' }}>{p}</p>)}
              {s.bullets && (
                <ul style={{ margin: '0 0 18px', padding: 0, listStyle: 'none' }}>
                  {s.bullets.map((b, j) => (
                    <li key={j} style={{ padding: '5px 0 5px 24px', position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, color: C.gold }}>•</span>
                      {b}
                    </li>
                  ))}
                </ul>
              )}
              {s.bodyAfter?.map((p, j) => <p key={j} style={{ margin: '0 0 18px' }}>{p}</p>)}
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${C.goldborder}`, margin: '0 0 48px' }} />

        <div style={{ marginBottom: 56 }}>
          <h2 style={{ margin: '0 0 32px', fontFamily: "'Playfair Display', serif", fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 700, color: C.cream }}>
            Frequently Asked Questions
          </h2>
          <div style={{ display: 'grid', gap: 0 }}>
            {ARTICLE.faqs.map((f, i) => (
              <div key={i} style={{ borderBottom: `1px solid ${C.goldborder}`, padding: '22px 0' }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(14px, 1.8vw, 16px)', fontWeight: 600, color: C.cream, marginBottom: 10 }}>
                  {f.q}
                </div>
                <div style={{ fontSize: 'clamp(14px, 1.8vw, 15px)', lineHeight: 1.7, color: C.cream2 }}>
                  {f.a}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.goldborder}`, padding: '36px 0 0' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.gold, marginBottom: 14 }}>
            About UAIU Holdings
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.7, color: C.cream2 }}>
            {ARTICLE.about}
          </p>
          <a href="https://uaiu.live/x" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.gold, textDecoration: 'none', letterSpacing: '0.08em' }}>
            Platform: uaiu.live/x
          </a>
          <p style={{ margin: '16px 0 0', fontSize: 12, fontStyle: 'italic', color: C.cream3 }}>
            {ARTICLE.reproduction}
          </p>
        </div>

        <div style={{ marginTop: 56, paddingTop: 28, borderTop: `1px solid ${C.goldborder}`, display: 'flex', justifyContent: 'center' }}>
          <button
            data-testid="button-download-pdf-bottom"
            onClick={downloadPDF}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              background: 'rgba(212,168,67,0.08)',
              border: `1px solid ${C.gold}`,
              color: C.gold,
              padding: '12px 32px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,168,67,0.16)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,168,67,0.08)'; }}
          >
            Download PDF Editorial
          </button>
        </div>

      </div>
    </div>
  );
}
