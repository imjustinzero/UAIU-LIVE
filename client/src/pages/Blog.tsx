import { Link } from "wouter";
import { useSEO } from "@/lib/seo";

type BlogSection = {
  heading?: string;
  body?: string[];
  bullets?: string[];
};

type BlogPost = {
  title: string;
  metaDescription: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  datePublished: string;
  sections: BlogSection[];
};

const C = {
  ink: '#060810',
  ink2: '#0d1220',
  gold: '#d4a843',
  goldborder: 'rgba(212,168,67,0.22)',
  cream: '#f2ead8',
  cream2: 'rgba(242,234,216,0.82)',
  cream3: 'rgba(242,234,216,0.55)',
};

const POSTS: BlogPost[] = [
  {
    title: 'EU ETS Maritime Compliance 2025: What Every Shipping Operator Needs to Know',
    metaDescription:
      'EU ETS now covers maritime shipping. Every vessel operator faces €100/tonne in fines for non-compliance. Here is what you need to know and how to procure compliant carbon credits before your next deadline.',
    primaryKeyword: 'EU ETS maritime compliance',
    secondaryKeywords: ['maritime carbon credits', 'IMO CII', 'shipping carbon compliance', 'EU ETS 2025'],
    datePublished: '2026-03-07',
    sections: [
      {
        body: [
          'The rules changed. If you operate vessels in European waters and have not updated your carbon procurement strategy, you are already behind and the fines are not symbolic.',
          'The European Union Emissions Trading System expanded to cover maritime shipping in 2024. Combined with IMO CII enforcement and CORSIA Phase 1 for aviation, the compliance window is already active.',
        ],
      },
      {
        heading: 'What changed: EU ETS maritime expansion',
        bullets: [
          'Covered vessels: all ships of 5,000 GT and above.',
          'Voyages between EU ports: 100% of emissions covered.',
          'Voyages between EU and non-EU ports: 50% of emissions covered.',
          'Vessels at berth in EU ports are included.',
          'Phase-in: 2024 = 40%, 2025 = 70%, 2026 = 100% of verified emissions must be covered.',
          'Penalty: €100 per tonne of CO2e not covered by surrendered allowances.',
        ],
      },
      {
        heading: 'IMO CII and CORSIA pressure in parallel',
        body: [
          'IMO CII rates vessels annually from A to E based on carbon intensity. D for three consecutive years or E for one year triggers corrective action plan requirements.',
          'Aviation operators face equivalent pressure under CORSIA Phase 1 with offsetting obligations tied to verified, auditable credits.',
        ],
      },
      {
        heading: 'What audit-ready procurement requires',
        bullets: [
          'Registry-verifiable provenance with project IDs and serial numbers.',
          'Documented chain of custody from seller to buyer with dates and standards.',
          'Retirement confirmation in the source registry.',
          'Tamper-evident records suitable for CSRD / ESRS E1 assurance.',
          'Compliance deadline tracking and proactive reminders.',
        ],
      },
      {
        heading: 'How UAIU.LIVE/X supports compliance teams',
        bullets: [
          'EU ETS-ready PDF audit pack per trade, including registry references and SHA-256 hash.',
          'Public trade verification at uaiu.live/verify/{TRADE-ID}.',
          'Escrow-protected settlement through Stripe Connect (T+1).',
          'Multi-signature compliance approval workflow for institutional controls.',
          'AI due diligence output with risk scoring and comparable trades.',
        ],
      },
    ],
  },
  {
    title: 'Why Carbon Credit Audit Documentation Will Make or Break Your ESG Report in 2025',
    metaDescription:
      'CSRD and ESRS E1 now require auditable, verifiable carbon procurement records. Learn what your ESG report must include and where most teams fail on carbon credit documentation.',
    primaryKeyword: 'carbon credit audit documentation',
    secondaryKeywords: ['CSRD carbon credits', 'ESRS E1 compliance', 'ESG carbon procurement', 'carbon credit ESG reporting'],
    datePublished: '2026-03-07',
    sections: [
      {
        body: [
          'Voluntary sustainability storytelling is over. Under CSRD and ESRS E1, climate disclosure is mandatory, standardized, and auditable for covered companies.',
          'For organizations using carbon credits in net-zero strategies, the quality of documentation now determines whether claims survive assurance and legal scrutiny.',
        ],
      },
      {
        heading: 'What CSRD / ESRS E1 requires',
        bullets: [
          'Full Scope 1, 2, and 3 emissions disclosure using GHG Protocol-aligned methodology.',
          'Transition plan alignment to 1.5°C goals, including interim actions.',
          'Separate and transparent disclosure of carbon credit use.',
          'Third-party assurance requirements that increase over time.',
        ],
      },
      {
        heading: 'Most common documentation failures',
        bullets: [
          'No direct registry serial trail for purchased credits.',
          'Credits purchased but never retired in registry.',
          'Evidence assembled retroactively instead of at trade time.',
          'No standardized audit artifact across brokers and years.',
          'Greenwashing exposure from unsubstantiated neutrality claims.',
        ],
      },
      {
        heading: 'Audit-ready standard for each transaction',
        bullets: [
          'Registry reference: project ID plus serial number range.',
          'Immutable timestamped trade confirmation.',
          'Retirement certificate and status visibility.',
          'Third-party project verification references.',
          'Fee and pricing transparency in consistent format.',
          'Framework alignment notes (EU ETS, CORSIA, CSRD, voluntary scope 3).',
        ],
      },
      {
        heading: 'Operational takeaway',
        body: [
          'Documentation quality is now a material risk issue, not an admin detail. Teams that can produce clean, tamper-evident, registry-linked evidence will have a defensible ESG posture in 2025 and beyond.',
        ],
      },
    ],
  },
  {
    title: 'How to Register Carbon Credits with Verra VCS: The Complete 2025 Guide',
    metaDescription:
      'Step-by-step guide to registering carbon credits with Verra VCS in 2025, from project qualification and methodology selection to VVB validation and first issuance.',
    primaryKeyword: 'how to register carbon credits Verra VCS',
    secondaryKeywords: ['Verra VCS registration', 'carbon credit registration guide', 'VCS methodology', 'REDD+ registration'],
    datePublished: '2026-03-07',
    sections: [
      {
        body: [
          'Verra VCS remains one of the most used voluntary carbon standards globally. Registration is demanding, but it is the path to institutionally recognizable credits.',
          'Most projects require a two-to-four-year process with technical documentation, third-party validation, and verification before first issuance.',
        ],
      },
      {
        heading: 'Step-by-step registration path',
        bullets: [
          'Step 1: Confirm project qualification and additionality.',
          'Step 2: Select the correct approved methodology.',
          'Step 3: Build a complete Project Design Document (PDD).',
          'Step 4: Open and configure your Verra Registry account.',
          'Step 5: Engage an accredited Validation and Verification Body (VVB).',
          'Step 6: Submit validation package and respond to Verra review queries.',
          'Step 7: Complete monitoring + verification for first VCU issuance.',
        ],
      },
      {
        heading: 'What determines success',
        bullets: [
          'Methodology-project fit and defensible baseline assumptions.',
          'Strong land tenure and stakeholder consultation records.',
          'Credible monitoring plan and emission reduction calculations.',
          'Clear non-permanence risk treatment for AFOLU projects.',
          'Experienced VVB support aligned to your scope and geography.',
        ],
      },
      {
        heading: 'From registration to trading',
        body: [
          'After issuance to your registry account, credits become tradeable. Teams should adopt procurement infrastructure that automatically generates registry-linked audit artifacts, retirement evidence, and compliance-ready records.',
        ],
      },
    ],
  },
];

const BLOG_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: 'UAIU Blog',
  url: 'https://uaiu.live/blog',
  blogPost: POSTS.map((post) => ({
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.metaDescription,
    datePublished: post.datePublished,
    dateModified: post.datePublished,
    keywords: [post.primaryKeyword, ...post.secondaryKeywords].join(', '),
    author: {
      '@type': 'Organization',
      name: 'UAIU Holdings Corp',
    },
    publisher: {
      '@type': 'Organization',
      name: 'UAIU Holdings Corp',
      url: 'https://uaiu.live',
    },
    mainEntityOfPage: 'https://uaiu.live/blog',
  })),
};

export default function Blog() {
  useSEO({
    title: 'UAIU Blog | EU ETS Maritime Compliance, CSRD Audit Documentation, and Verra VCS Guides',
    description:
      'UAIU blog resources on EU ETS maritime compliance, carbon credit audit documentation for CSRD/ESRS E1, and Verra VCS registration guides for project developers.',
    path: '/blog',
    ogType: 'website',
    jsonLd: BLOG_SCHEMA,
  });

  return (
    <div style={{ minHeight: '100vh', background: C.ink, color: C.cream, fontFamily: "'Syne', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,400&family=Syne:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
      `}</style>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '0 24px 72px' }}>
        <div style={{ padding: '30px 0 20px', borderBottom: `1px solid ${C.goldborder}` }}>
          <Link href="/x" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.gold, textDecoration: 'none', letterSpacing: '0.12em' }}>
            ← UAIU.LIVE/X
          </Link>
          <h1 style={{ margin: '24px 0 10px', fontFamily: "'Playfair Display', serif", fontSize: 'clamp(30px, 5vw, 46px)', lineHeight: 1.2 }}>
            UAIU Carbon & Compliance Blog
          </h1>
          <p style={{ margin: 0, color: C.cream2, fontSize: 'clamp(15px, 2.1vw, 18px)', lineHeight: 1.7 }}>
            Deep guides for carbon markets, compliance operations, and audit-grade procurement.
          </p>
        </div>

        {POSTS.map((post, index) => (
          <article key={post.title} style={{ padding: '42px 0', borderBottom: index < POSTS.length - 1 ? `1px solid ${C.goldborder}` : 'none' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.12em', color: C.gold, textTransform: 'uppercase', marginBottom: 14 }}>
              Primary keyword: {post.primaryKeyword}
            </div>
            <h2 style={{ margin: '0 0 14px', fontFamily: "'Playfair Display', serif", fontSize: 'clamp(24px, 3.4vw, 38px)', lineHeight: 1.24 }}>
              {post.title}
            </h2>
            <p style={{ margin: '0 0 14px', color: C.cream2, lineHeight: 1.7 }}>{post.metaDescription}</p>
            <p style={{ margin: '0 0 28px', color: C.cream3, fontSize: 13, lineHeight: 1.6 }}>
              Secondary keywords: {post.secondaryKeywords.join(', ')}
            </p>

            <div style={{ display: 'grid', gap: 26 }}>
              {post.sections.map((section, sectionIndex) => (
                <section key={`${post.title}-section-${sectionIndex}`} style={{ background: C.ink2, border: `1px solid ${C.goldborder}`, borderRadius: 12, padding: '20px 18px' }}>
                  {section.heading && (
                    <h3 style={{ margin: '0 0 14px', fontFamily: "'Playfair Display', serif", fontSize: 'clamp(19px, 2.5vw, 25px)', lineHeight: 1.35 }}>
                      {section.heading}
                    </h3>
                  )}
                  {section.body?.map((paragraph, bodyIndex) => (
                    <p key={`${post.title}-body-${sectionIndex}-${bodyIndex}`} style={{ margin: '0 0 12px', color: C.cream2, lineHeight: 1.8 }}>
                      {paragraph}
                    </p>
                  ))}
                  {section.bullets && (
                    <ul style={{ margin: 0, paddingLeft: 18, color: C.cream2, lineHeight: 1.8 }}>
                      {section.bullets.map((bullet, bulletIndex) => (
                        <li key={`${post.title}-bullet-${sectionIndex}-${bulletIndex}`} style={{ marginBottom: 6 }}>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
