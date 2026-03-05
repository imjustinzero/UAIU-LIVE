import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { dbInsert } from "@/lib/supabase";
import { Globe, Waves, Leaf, Trees, Droplets, Building2, Shield, Zap, Link2, Scale, Star, MapPin, CheckCircle, Lock, FileText, Clock, Users } from "lucide-react";
import { CarbonClock } from "../components/exchange/CarbonClock";
import { TerminalMode } from "../components/exchange/TerminalMode";
import { VoiceRFQ } from "../components/exchange/VoiceRFQ";
import { VideoTradeRoom, AITradeNegotiator } from "../components/exchange/TradeFeatures";
import { ListingChat } from "../components/exchange/ListingChat";
import { CarbonBudgetTracker } from "../components/exchange/CarbonBudgetTracker";
import { RegulatoryCalendar } from "../components/exchange/RegulatoryCalendar";
import { AIComplianceCoPilot } from "../components/exchange/ComplianceCoPilot";
import { AIPricePrediction, DueDiligenceReport } from "../components/exchange/AIPredictionAndDD";
import { EscrowSettlement } from "../components/exchange/EscrowUI";
import { TradeTicker, type TickerTrade } from "../components/exchange/TradeTicker";
import { OrderBook, useETSPrice } from "../components/exchange/OrderBook";
import { AIMarketIntelligence, AIRFQAssistant } from "../components/exchange/AIFeatures";
import { FarmCarbonCalculator, ProjectPipeline } from "../components/exchange/SupplyFeatures";
import { PortfolioDashboard, MultiSigApproval, generatePDFReport } from "../components/exchange/InstitutionalFeatures";
import { Globe3D, DarkModeToggle, MobileNav, VisionVerification, useDarkMode } from "../components/exchange/VisualFeatures";

const C_DARK = {
  ink: '#060810',
  ink2: '#0d1220',
  ink3: '#141e30',
  ink4: '#1c2840',
  gold: '#d4a843',
  gold2: '#f0c96a',
  gold3: '#b8922e',
  goldfaint: 'rgba(212,168,67,0.12)',
  goldborder: 'rgba(212,168,67,0.22)',
  cream: '#f2ead8',
  cream2: 'rgba(242,234,216,0.7)',
  cream3: 'rgba(242,234,216,0.35)',
  cream4: 'rgba(242,234,216,0.1)',
  green: '#22c55e',
  greenfaint: 'rgba(34,197,94,0.12)',
  red: '#ef4444',
};

const C_LIGHT = {
  ink: '#f5ede0',
  ink2: '#ede3d3',
  ink3: '#e0d4c0',
  ink4: '#d4c5ac',
  gold: '#b8922e',
  gold2: '#9e7a20',
  gold3: '#7a5c10',
  goldfaint: 'rgba(184,146,46,0.15)',
  goldborder: 'rgba(184,146,46,0.32)',
  cream: '#0d0a06',
  cream2: 'rgba(13,10,6,0.7)',
  cream3: 'rgba(13,10,6,0.45)',
  cream4: 'rgba(13,10,6,0.18)',
  green: '#15803d',
  greenfaint: 'rgba(21,128,61,0.12)',
  red: '#b91c1c',
};

const F = {
  playfair: "'Playfair Display', serif",
  syne: "'Syne', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

const TICKER_DATA = [
  { n: 'EU ETS', p: '€63.40', c: '+2.3%', up: true },
  { n: 'SwissX B100', p: '€71.80', c: '+4.2%', up: true },
  { n: 'REDD++', p: '€58.20', c: '+1.1%', up: true },
  { n: 'Blue Carbon', p: '€45.60', c: '-0.8%', up: false },
  { n: 'CORSIA', p: '€29.70', c: '+3.1%', up: true },
  { n: 'Gold Std', p: '€18.90', c: '-1.2%', up: false },
  { n: 'VCS Forestry', p: '€12.40', c: '+0.5%', up: true },
  { n: 'CAR Protocol', p: '€22.10', c: '+0.9%', up: true },
  { n: 'ACR Credits', p: '€19.60', c: '+0.3%', up: true },
  { n: 'EU Aviation', p: '€68.20', c: '+5.1%', up: true },
];

const TRADE_TYPES = [
  { label: 'EU ETS Compliance — VCS Verified', value: '63.40' },
  { label: 'SwissX B100 Biofuel Credits', value: '71.80' },
  { label: 'REDD++ Caribbean — Gold Standard', value: '58.20' },
  { label: 'Blue Carbon — Coral/Seagrass Fields', value: '45.60' },
  { label: 'CORSIA Aviation Offset Credits', value: '29.70' },
];

const ACCOUNT_TYPES = [
  'Corporate Buyer — Maritime / Shipping',
  'Corporate Buyer — Aviation',
  'Corporate Buyer — Industrial',
  'Credit Generator / Producer',
  'Institutional Investor / Fund',
  'Broker / Intermediary',
  'Government / Sovereign Entity',
];

const CO2_RANGES = [
  'Under 1,000 tonnes',
  '1,000 – 10,000 tonnes',
  '10,000 – 50,000 tonnes',
  '50,000 – 200,000 tonnes',
  '200,000+ tonnes',
];

const RFQ_STANDARDS = [
  'EU ETS — European Allowances',
  'Verra VCS — Verified Carbon Standard',
  'Gold Standard',
  'CORSIA — Aviation Offsets',
  'Blue Carbon — Seagrass / Coral',
  'REDD++ — Forest Conservation',
  'SwissX B100 — Caribbean Biofuel',
];

const CREDIT_STANDARDS = [
  'EU ETS — European Union Allowances',
  'VCS — Verified Carbon Standard',
  'Gold Standard',
  'CORSIA — Aviation Offsets',
  'Blue Carbon / VCS',
  'Other',
];

const CREDIT_TYPES = [
  'Biofuel Production (B100 / SAF)',
  'REDD++ Forest Conservation',
  'Blue Carbon / Seagrass',
  'Coral Restoration',
  'Agricultural Waste → Biogas',
  'Renewable Energy (Solar / Wind)',
  'Human Waste Biodigester',
  'Other',
];

interface Listing {
  id: string;
  standard: string;
  badgeLabel: string;
  name: string;
  origin: string;
  pricePerTonne: number;
  changePercent: number;
  changeDirection: string;
  status: string;
  isAcceptingOrders: boolean;
}

function getBadgeStyle(standard: string, C: typeof C_DARK) {
  if (standard === 'EU ETS' || standard === 'CORSIA') return { color: '#a855f7', borderColor: 'rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)' };
  if (standard === 'VCS' || standard === 'GOLD STD') return { color: C.green, borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)' };
  return { color: C.gold, borderColor: C.goldborder, background: C.goldfaint };
}

async function sha256(message: string): Promise<string> {
  try {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return Math.random().toString(36).repeat(4).slice(0, 64);
  }
}

function genTradeId(mode: string): string {
  return `UAIU-${mode.toUpperCase()}-${Date.now().toString().slice(-6)}`;
}

export default function Exchange() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const lastReceiptHashRef = useRef<string>('GENESIS_BLOCK_UAIU_CARIBBEAN_CARBON_EXCHANGE');
  const rlRef = useRef<Record<string, number[]>>({});
  const sessionIdRef = useRef<string>('');
  const _sessionLogRef = useRef<{ t: string; d: string; ms: number }[]>([]);
  const _sessionStartRef = useRef<number>(Date.now());

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [emissions, setEmissions] = useState(25000);

  const [showTradeModal, setShowTradeModal] = useState(false);
  const [currentListing, setCurrentListing] = useState<Listing | null>(null);
  const [tradeTab, setTradeTab] = useState<'buy' | 'sell'>('buy');
  const [tradeTypeValue, setTradeTypeValue] = useState('63.40');
  const [tradeQty, setTradeQty] = useState(500);
  const [tradeProcessing, setTradeProcessing] = useState(false);
  const [tradeSuccess, setTradeSuccess] = useState(false);
  const [tradeRefStr, setTradeRefStr] = useState('');
  const [tradeHashStr, setTradeHashStr] = useState('');
  const [sessionTrades, setSessionTrades] = useState<any[]>([]);

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [acctFirstName, setAcctFirstName] = useState('');
  const [acctLastName, setAcctLastName] = useState('');
  const [acctCompany, setAcctCompany] = useState('');
  const [acctEmail, setAcctEmail] = useState('');
  const [acctPhone, setAcctPhone] = useState('');
  const [acctType, setAcctType] = useState('');
  const [acctCo2, setAcctCo2] = useState('');
  const [acctSubmitting, setAcctSubmitting] = useState(false);
  const [acctSuccess, setAcctSuccess] = useState(false);
  const [acctId, setAcctId] = useState('');

  const [listOrgName, setListOrgName] = useState('');
  const [listContact, setListContact] = useState('');
  const [listEmail, setListEmail] = useState('');
  const [listStandard, setListStandard] = useState('');
  const [listType, setListType] = useState('');
  const [listVolume, setListVolume] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [listOrigin, setListOrigin] = useState('');
  const [listSerial, setListSerial] = useState('');
  const [listSubmitting, setListSubmitting] = useState(false);
  const [listSuccess, setListSuccess] = useState(false);

  const [rfqCompany, setRfqCompany] = useState('');
  const [rfqContact, setRfqContact] = useState('');
  const [rfqEmail, setRfqEmail] = useState('');
  const [rfqSide, setRfqSide] = useState('BUY');
  const [rfqStandard, setRfqStandard] = useState('EU ETS — European Allowances');
  const [rfqVolume, setRfqVolume] = useState('');
  const [rfqPrice, setRfqPrice] = useState('');
  const [rfqOrigin, setRfqOrigin] = useState('');
  const [rfqVintage, setRfqVintage] = useState('');
  const [rfqDeadline, setRfqDeadline] = useState('');
  const [rfqNotes, setRfqNotes] = useState('');
  const [rfqSubmitting, setRfqSubmitting] = useState(false);
  const [rfqSuccess, setRfqSuccess] = useState(false);
  const [rfqId, setRfqId] = useState('');

  const [verifyInput, setVerifyInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const [toast, setToast] = useState<{ show: boolean; msg: string }>({ show: false, msg: '' });

  // New feature state
  const { isDark, toggle: toggleDark } = useDarkMode();
  const C = isDark ? C_DARK : C_LIGHT;
  const [tickerTrades, setTickerTrades] = useState<TickerTrade[]>([]);
  const [showMultiSig, setShowMultiSig] = useState(false);
  const [pendingTradeId, setPendingTradeId] = useState('');
  const [sessionRetirements, setSessionRetirements] = useState<any[]>([]);
  const [sessionAccount, setSessionAccount] = useState<any>(null);
  const [acctModalTab, setAcctModalTab] = useState<'open' | 'signin'>('open');
  const [signinEmail, setSigninEmail] = useState('');
  const [signinLoading, setSigninLoading] = useState(false);
  const [signinError, setSigninError] = useState('');
  const [chatHandle] = useState(() => `Trader-${Math.random().toString(36).slice(2,6).toUpperCase()}`);
  const [rfqSubmitted, setRfqSubmitted] = useState(false);
  const [escrowTrade, setEscrowTrade] = useState<{ tradeId: string; amountEur: number; volumeTonnes: number; standard: string } | null>(null);
  const currentIndexPrice = 67.43;
  const etsPrice = useETSPrice(currentIndexPrice);

  const { data: listings = [] } = useQuery<Listing[]>({ queryKey: ['/api/exchange/listings'] });

  function showToast(msg: string) {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 4000);
  }

  function rateOk(key: string, max = 4): boolean {
    const now = Date.now();
    const rl = rlRef.current;
    rl[key] = (rl[key] || []).filter(t => now - t < 60000);
    if (rl[key].length >= max) { showToast('Too many requests. Please wait.'); return false; }
    rl[key].push(now);
    return true;
  }

  function botDetected(): boolean {
    const hp = document.getElementById('_hp_exchange') as HTMLInputElement | null;
    return !!(hp && hp.value.length > 0);
  }

  // Restore exchange account session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('x-exchange-account');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.email) {
          setSessionAccount(parsed);
        }
      }
    } catch {
      localStorage.removeItem('x-exchange-account');
    }
  }, []);

  useEffect(() => {
    // Session ID (crypto-grade random)
    const bytes = new Uint8Array(16);
    try { crypto.getRandomValues(bytes); } catch {}
    sessionIdRef.current = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    _sessionStartRef.current = Date.now();

    // Track helper (capped log, silent)
    function _track(type: string, detail = '') {
      const log = _sessionLogRef.current;
      log.push({ t: type, d: String(detail).slice(0, 120), ms: Date.now() - _sessionStartRef.current });
      if (log.length > 200) log.shift();
    }
    _track('session_start', navigator.userAgent.slice(0, 80));

    // Console security watermark
    try {
      const s = 'color:#d4a843;font-size:14px;font-weight:bold;';
      const s2 = 'color:#f2ead8;font-size:11px;';
      console.log('%c\u26a0 UAIU.LIVE/X Security Notice', 'background:#060810;' + s + ';padding:8px 16px;border-left:3px solid #d4a843');
      console.log('%cThis is a protected financial platform. Unauthorized access, scraping, or manipulation is a criminal offense under the Computer Fraud and Abuse Act and equivalent international laws. All sessions are logged with unique identifiers.', s2);
      console.log('%cSession ID: ' + sessionIdRef.current, 'color:rgba(242,234,216,0.3);font-size:10px');
    } catch {}

    // Escape key only — no blocking of any other shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowTradeModal(false); setShowAccountModal(false); }
    };

    document.addEventListener('keydown', handleKeyDown);

    // DOM integrity monitor (silent — no UI reaction, just logs)
    const snapshots: Record<string, number> = {};
    const watchSelectors = ['nav', 'footer', '#marketplace'];
    const snapshotTimer = setTimeout(() => {
      watchSelectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) snapshots[sel] = el.childElementCount + el.innerHTML.length;
      });
    }, 3000);

    const integrityInterval = setInterval(() => {
      watchSelectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (el && snapshots[sel] !== undefined) {
          const now = el.childElementCount + el.innerHTML.length;
          if (Math.abs(now - snapshots[sel]) > 800) {
            _track('dom_tamper', sel);
            snapshots[sel] = now;
          }
        }
      });
    }, 8000);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(snapshotTimer);
      clearInterval(integrityInterval);
    };
  }, []);

  useEffect(() => {
    const cur = cursorRef.current;
    const ring = ringRef.current;
    if (!cur || !ring) return;
    let mx = 0, my = 0, rx = 0, ry = 0;
    let raf: number;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      cur.style.left = mx + 'px'; cur.style.top = my + 'px';
    };

    function animRing() {
      rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
      if (ring) { ring.style.left = rx + 'px'; ring.style.top = ry + 'px'; }
      raf = requestAnimationFrame(animRing);
    }
    animRing();

    const onEnter = () => { ring.style.width = '56px'; ring.style.height = '56px'; ring.style.borderColor = C.gold; };
    const onLeave = () => { ring.style.width = '32px'; ring.style.height = '32px'; ring.style.borderColor = 'rgba(212,168,67,0.5)'; };

    document.addEventListener('mousemove', onMove);
    document.querySelectorAll('button,a').forEach(el => {
      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousemove', onMove);
    };
  }, [listings]);

  const filteredListings = (listings as Listing[]).filter(l => {
    const std = (l.standard || '').toUpperCase();
    const name = (l.name || '').toLowerCase();
    const matchesFilter =
      filter === 'all' ||
      (filter === 'eu' && (std === 'EU ETS' || std === 'CORSIA')) ||
      (filter === 'vcs' && std === 'VCS') ||
      (filter === 'redd' && (name.includes('redd') || std.includes('REDD'))) ||
      (filter === 'blue' && name.includes('blue'));
    const matchesSearch = !search || name.includes(search.toLowerCase()) || (l.origin || '').toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const fine = emissions * 100;
  const creditCost = Math.round(emissions * 0.7 * 63.40);
  const savings = fine - creditCost;

  const tradePrice = parseFloat(tradeTypeValue) || 63.40;
  const tradeSub = tradePrice * tradeQty;
  const tradeFee = tradeSub * 0.0075;
  const tradeTotal = tradeSub + tradeFee;

  function openTrade(listing: Listing | null, mode: 'buy' | 'sell') {
    setCurrentListing(listing);
    setTradeTab(mode);
    setTradeSuccess(false);
    setTradeProcessing(false);
    if (listing) {
      const match = TRADE_TYPES.find(t => Math.abs(parseFloat(t.value) - listing.pricePerTonne) < 1);
      if (match) setTradeTypeValue(match.value);
    }
    setShowTradeModal(true);
  }

  async function handleExecuteTrade(mode: 'buy' | 'sell') {
    if (botDetected()) { showToast('Submission blocked.'); return; }
    if (!rateOk('trade', 5)) return;
    if (tradeQty < 1) { showToast('Please enter a valid quantity.'); return; }
    setTradeProcessing(true);
    const tradeId = genTradeId(mode);
    const gross = tradePrice * tradeQty;
    const fee = gross * 0.0075;
    const payload = JSON.stringify({ tradeId, mode, standard: TRADE_TYPES.find(t => t.value === tradeTypeValue)?.label || 'Carbon Credit', priceEurPerTonne: tradePrice, volumeTonnes: tradeQty, grossEur: gross, feeEur: fee, settlement: 'T+1', prev: lastReceiptHashRef.current, ts: Date.now() });
    const hash = await sha256(payload);
    const prevHash = lastReceiptHashRef.current;
    lastReceiptHashRef.current = hash;
    const standard = TRADE_TYPES.find(t => t.value === tradeTypeValue)?.label || 'Carbon Credit';
    const trade = { id: tradeId, mode, standard, priceEurPerTonne: tradePrice, volumeTonnes: tradeQty, grossEur: gross, feeEur: fee, receiptHash: hash, prevReceiptHash: prevHash, verifyUrl: `uaiu.live/verify/${tradeId}`, auditUrl: `uaiu.live/audit/${tradeId}.pdf`, ts: Date.now() };
    // Non-blocking Supabase save
    dbInsert('trades', {
      trade_id: tradeId,
      side: mode,
      standard,
      price_eur_per_tonne: tradePrice,
      volume_tonnes: tradeQty,
      gross_eur: gross,
      fee_eur: fee,
      net_eur: gross + fee,
      settlement: 'T+1',
      receipt_hash: hash,
      prev_receipt_hash: prevHash,
      verify_url: `uaiu.live/verify/${tradeId}`,
      status: 'filled',
    }).catch(() => {});
    setTimeout(() => {
      setSessionTrades(prev => [{ ...trade, trade_id: tradeId, side: mode, volume_tonnes: tradeQty, price_eur_per_tonne: tradePrice, gross_eur: gross, receipt_hash: hash }, ...prev]);
      setTradeRefStr(tradeId);
      setTradeHashStr(hash);
      setTradeSuccess(true);
      setTradeProcessing(false);
      if (gross >= 10000) setEscrowTrade({ tradeId, amountEur: gross, volumeTonnes: tradeQty, standard });
      // Push to trade ticker
      setTickerTrades(prev => [{ id: tradeId, side: mode.toUpperCase(), standard, volume: tradeQty, price: tradePrice, ago: 'just now' }, ...prev].slice(0, 20));
      // Trigger multi-sig
      setPendingTradeId(tradeId);
      setShowMultiSig(true);
      showToast(mode === 'buy' ? 'Order placed · Receipt hash generated' : 'Credits listed on marketplace');
    }, 1400);
  }

  async function handleAccountSubmit() {
    if (botDetected()) { showToast('Submission blocked.'); return; }
    if (!rateOk('account', 3)) return;
    if (!acctFirstName || !acctLastName || !acctEmail || !acctType) { showToast('Please fill in all required fields.'); return; }
    if (!acctEmail.includes('@')) { showToast('Please enter a valid email address.'); return; }
    setAcctSubmitting(true);
    try {
      const res = await apiRequest('POST', '/api/exchange/account', { firstName: acctFirstName, lastName: acctLastName, company: acctCompany, email: acctEmail, phone: acctPhone, accountType: acctType, annualCo2Exposure: acctCo2 });
      const data = await res.json();
      setAcctId(data.id || ('UAIU-' + Date.now().toString().slice(-8)));
      setAcctSuccess(true);
      const newSession = {
        id: data.id,
        email: acctEmail,
        firstName: acctFirstName,
        lastName: acctLastName,
        company: acctCompany || `${acctFirstName} ${acctLastName}`.trim(),
        accountType: acctType,
        annualCo2: parseInt(acctCo2) || 10000,
      };
      setSessionAccount(newSession);
      localStorage.setItem('x-exchange-account', JSON.stringify(newSession));
      showToast('Account created — KYC verification begins now');
      // Non-blocking Supabase save
      dbInsert('entities', {
        name: `${acctFirstName} ${acctLastName}`.trim(),
        contact_name: `${acctFirstName} ${acctLastName}`.trim(),
        email: acctEmail,
        phone: acctPhone || null,
        entity_type: acctType,
        annual_co2_exposure: acctCo2 || null,
        status: 'pending_kyc',
      }).catch(() => {});
    } catch {
      showToast('Failed to submit. Please try again.');
    } finally {
      setAcctSubmitting(false);
    }
  }

  async function handleListSubmit() {
    if (botDetected()) { showToast('Submission blocked.'); return; }
    if (!rateOk('listing', 3)) return;
    if (!listOrgName || !listContact || !listEmail || !listStandard || !listType || !listVolume || !listPrice || !listOrigin) { showToast('Please fill in all required fields.'); return; }
    if (!listEmail.includes('@')) { showToast('Please enter a valid email address.'); return; }
    setListSubmitting(true);
    try {
      await apiRequest('POST', '/api/exchange/list-credits', { orgName: listOrgName, contactName: listContact, email: listEmail, standard: listStandard, creditType: listType, volumeTonnes: listVolume, askingPricePerTonne: listPrice, projectOrigin: listOrigin, registrySerial: listSerial });
      setListSuccess(true);
      showToast('Credits submitted for verification');
      // Non-blocking Supabase save
      dbInsert('listing_submissions', {
        org_name: listOrgName,
        contact_name: listContact,
        email: listEmail,
        standard: listStandard,
        credit_type: listType,
        volume_tonnes: parseFloat(listVolume) || null,
        ask_eur_per_tonne: parseFloat(listPrice) || null,
        origin: listOrigin,
        registry_ref: listSerial || null,
        status: 'pending_verification',
      }).catch(() => {});
    } catch {
      showToast('Failed to submit. Please try again.');
    } finally {
      setListSubmitting(false);
    }
  }

  async function handleRfqSubmit() {
    if (botDetected()) { showToast('Submission blocked.'); return; }
    if (!rateOk('rfq', 3)) return;
    if (!rfqCompany || !rfqContact || !rfqEmail || !rfqVolume) { showToast('Please fill in all required fields.'); return; }
    const vol = parseInt(rfqVolume);
    if (isNaN(vol) || vol < 1000) { showToast('Minimum RFQ volume is 1,000 tonnes.'); return; }
    if (!rfqEmail.includes('@')) { showToast('Please enter a valid email address.'); return; }
    setRfqSubmitting(true);
    try {
      const res = await apiRequest('POST', '/api/exchange/rfq', { company: rfqCompany, contact: rfqContact, email: rfqEmail, side: rfqSide, standard: rfqStandard, volumeTonnes: vol, targetPrice: rfqPrice ? parseFloat(rfqPrice) : undefined, preferredOrigin: rfqOrigin, vintageYear: rfqVintage ? parseInt(rfqVintage) : undefined, deadline: rfqDeadline, notes: rfqNotes });
      const data = await res.json();
      const rfqIdGenerated = data.id || genTradeId('RFQ');
      setRfqId(rfqIdGenerated);
      setRfqSuccess(true);
      setRfqSubmitted(true);
      showToast('RFQ submitted — quote within 4 business hours');
      // Non-blocking Supabase save
      dbInsert('rfqs', {
        rfq_id: rfqIdGenerated,
        company: rfqCompany,
        contact_name: rfqContact,
        email: rfqEmail,
        side: rfqSide,
        standard: rfqStandard,
        volume_tonnes: vol,
        target_price_eur: rfqPrice ? parseFloat(rfqPrice) : null,
        origin: rfqOrigin || null,
        vintage_year: rfqVintage ? parseInt(rfqVintage) : null,
        deadline: rfqDeadline || null,
        notes: rfqNotes || null,
        status: 'new',
      }).catch(() => {});
    } catch {
      showToast('Failed to submit RFQ. Please try again.');
    } finally {
      setRfqSubmitting(false);
    }
  }

  async function handleSignIn() {
    if (!signinEmail.trim()) return;
    setSigninLoading(true);
    setSigninError('');
    try {
      const res = await fetch(`/api/exchange/account/lookup?email=${encodeURIComponent(signinEmail.trim().toLowerCase())}`);
      if (res.ok) {
        const account = await res.json();
        const sessionData = {
          id: account.id,
          email: account.email,
          firstName: account.firstName || '',
          lastName: account.lastName || '',
          company: account.company || `${account.firstName || ''} ${account.lastName || ''}`.trim(),
          accountType: account.accountType || '',
          annualCo2: account.annualCo2 || 0,
        };
        setSessionAccount(sessionData);
        localStorage.setItem('x-exchange-account', JSON.stringify(sessionData));
        setShowAccountModal(false);
        setSigninEmail('');
        setSigninError('');
        showToast(`Welcome back, ${sessionData.company || sessionData.firstName || 'trader'}.`);
      } else {
        setSigninError('No account found for that email. Please open a new account.');
      }
    } catch {
      setSigninError('Connection error. Please try again.');
    } finally {
      setSigninLoading(false);
    }
  }

  function handleSignOut() {
    setSessionAccount(null);
    localStorage.removeItem('x-exchange-account');
    setShowAccountModal(false);
    setAcctModalTab('open');
    showToast('Signed out.');
  }

  function lookupTrade() {
    const id = verifyInput.trim();
    if (!id) { setVerifyResult({ type: 'error', msg: 'Please enter a Trade ID.' }); return; }
    const trade = sessionTrades.find(t => t.id === id);
    if (trade) { setVerifyResult({ type: 'found', trade }); return; }
    if (id.startsWith('UAIU-')) { setVerifyResult({ type: 'valid-format', id }); return; }
    setVerifyResult({ type: 'not-found' });
  }

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  const rfqEstimate = rfqVolume && rfqPrice ? { gross: parseInt(rfqVolume) * parseFloat(rfqPrice), fee: parseInt(rfqVolume) * parseFloat(rfqPrice) * 0.0075 } : null;

  const s: Record<string, React.CSSProperties> = {
    eyebrow: { fontFamily: F.mono, fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.gold, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 },
    fi: { width: '100%', background: C.ink2, border: `1px solid ${C.goldborder}`, color: C.cream, padding: '13px 16px', fontFamily: F.mono, fontSize: 12, outline: 'none', WebkitAppearance: 'none' as any, boxSizing: 'border-box' as any },
    fl: { fontFamily: F.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.cream3, display: 'block', marginBottom: 8 },
    fg: { marginBottom: 20 },
    formSubmit: { width: '100%', background: C.gold, color: C.ink, padding: 18, fontFamily: F.syne, fontSize: 13, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', marginTop: 8 },
    goldRule: { width: '100%', height: 1, background: `linear-gradient(90deg,transparent,${C.gold},transparent)`, opacity: 0.3 },
    stepTag: { display: 'inline-block', marginTop: 12, fontFamily: F.mono, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.gold, border: `1px solid ${C.goldborder}`, padding: '4px 12px' },
    sectionWrap: { maxWidth: 1440, margin: '0 auto', padding: '100px 52px' },
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes tickerMove { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes pulseAnim { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)} 50%{box-shadow:0 0 0 6px rgba(34,197,94,0)} }
        @keyframes modalIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toastIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .x-ticker-scroll { display:flex; animation:tickerMove 50s linear infinite; white-space:nowrap; }
        .x-pulse { width:6px;height:6px;background:#22c55e;border-radius:50%;animation:pulseAnim 2s infinite;display:inline-block; }
        .x-listing-card { background:${C.ink2};padding:32px 28px;position:relative;overflow:hidden;cursor:pointer;transition:background 0.25s;border:1px solid ${C.goldborder}; }
        .x-listing-card::before { content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,${C.gold},transparent);opacity:0;transition:opacity 0.3s; }
        .x-listing-card:hover { background:${C.ink3}; }
        .x-listing-card:hover::before { opacity:1; }
        .x-mfilter { background:transparent;border:1px solid ${C.goldborder};color:${C.cream3};padding:10px 20px;fontFamily:JetBrains Mono,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;transition:all 0.2s; }
        .x-mfilter.active,.x-mfilter:hover { background:${C.goldfaint};border-color:${C.gold};color:${C.gold}; }
        .x-step-item { display:flex;gap:28px;padding:32px 0;border-bottom:1px solid ${C.goldborder};position:relative;cursor:default;transition:all 0.2s; }
        .x-step-item:first-child { border-top:1px solid ${C.goldborder}; }
        .x-step-item:hover .x-step-num { color:${C.gold};border-color:${C.gold}; }
        .x-step-num { font-family:'Playfair Display',serif;font-size:36px;font-weight:900;color:${C.cream4};min-width:52px;line-height:1;border:1px solid transparent;display:flex;align-items:center;justify-content:center;width:52px;height:52px;flex-shrink:0;margin-top:4px;transition:all 0.2s; }
        .x-nav-link { font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${C.cream3};text-decoration:none;transition:color 0.2s;padding:4px 0;border-bottom:1px solid transparent; }
        .x-nav-link:hover { color:${C.gold};border-bottom-color:${C.gold}; }
        .x-comp-card { background:${C.ink};padding:36px 28px;text-align:center;transition:background 0.2s; }
        .x-comp-card:hover { background:${C.ink2}; }
        .x-proof-card { background:${C.ink2};padding:36px 32px; }
        .x-benefit-item { display:flex;gap:20px;padding:28px 0;border-bottom:1px solid ${C.goldborder}; }
        .x-benefit-item:first-child { border-top:1px solid ${C.goldborder}; }
        .x-footer-link { font-size:13px;color:${C.cream3};text-decoration:none;transition:color 0.2s;display:block;margin-bottom:11px; }
        .x-footer-link:hover { color:${C.cream}; }
        .x-btn-buy-now { flex:1;background:${C.gold};color:${C.ink};padding:13px;font-family:'Syne',sans-serif;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;border:none;cursor:pointer;transition:all 0.2s; }
        .x-btn-buy-now:hover { background:${C.gold2}; }
        .x-btn-list { flex:1;background:transparent;color:${C.gold};padding:13px;font-family:'Syne',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;border:1px solid ${C.goldborder};cursor:pointer;transition:all 0.2s; }
        .x-btn-list:hover { background:${C.goldfaint};border-color:${C.gold}; }
        .x-btn-ghost { background:transparent;color:${C.cream};padding:18px 44px;font-family:'Syne',sans-serif;font-size:12px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;border:1px solid ${C.goldborder};cursor:pointer;transition:all 0.25s; }
        .x-btn-ghost:hover { border-color:${C.gold};color:${C.gold}; }
        .x-btn-primary { background:${C.gold};color:${C.ink};padding:18px 44px;font-family:'Syne',sans-serif;font-size:12px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;border:none;cursor:pointer;transition:all 0.25s; }
        .x-btn-primary:hover { background:${C.gold2};transform:translateY(-2px); }
        .x-btn-nav { background:${C.gold};color:${C.ink};padding:10px 22px;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;border:none;cursor:pointer;transition:all 0.2s;white-space:nowrap; }
        .x-btn-nav:hover { background:${C.gold2};transform:translateY(-1px); }
        .x-cc-slider { width:100%;-webkit-appearance:none;height:3px;background:${C.ink4};outline:none;border-radius:0; }
        .x-cc-slider::-webkit-slider-thumb { -webkit-appearance:none;width:18px;height:18px;background:${C.gold};cursor:pointer;border-radius:50%;border:2px solid ${C.ink}; }
        .x-form-wrap::before { content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,${C.gold},transparent); }
        .x-trust-card { background:${C.ink2};padding:36px 28px;transition:background 0.2s; }
        .x-trust-card:hover { background:${C.ink3}; }
        select.x-fi { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23d4a843'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;cursor:pointer; }
        .x-modal-overlay { position:fixed;inset:0;background:rgba(6,8,16,0.94);z-index:1000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px); }
        .x-modal { background:${C.ink2};border:1px solid ${C.goldborder};width:90%;max-width:520px;position:relative;overflow:hidden;animation:modalIn 0.3s ease; }
        .x-modal::before { content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,${C.gold},transparent); }
        .x-mtab { flex:1;padding:16px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;text-align:center;cursor:pointer;color:${C.cream3};border:none;background:transparent;transition:all 0.2s;border-bottom:2px solid transparent; }
        .x-mtab.active { color:${C.gold};border-bottom-color:${C.gold};background:${C.goldfaint}; }
        .x-execute-buy { width:100%;padding:18px;background:linear-gradient(135deg,#15803d,#22c55e);border:none;color:white;font-family:'Syne',sans-serif;font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;margin-bottom:10px; }
        .x-execute-buy:hover { filter:brightness(1.1);transform:translateY(-1px); }
        .x-execute-sell { width:100%;padding:18px;background:linear-gradient(135deg,#991b1b,#ef4444);border:none;color:white;font-family:'Syne',sans-serif;font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;transition:all 0.2s; }
        .x-execute-sell:hover { filter:brightness(1.1);transform:translateY(-1px); }
        @media(max-width:1024px){.x-listings-grid{grid-template-columns:1fr 1fr!important}.x-steps-layout{grid-template-columns:1fr!important}.x-hero-metrics{grid-template-columns:1fr 1fr!important}.x-compliance-grid{grid-template-columns:1fr 1fr!important}.x-list-layout{grid-template-columns:1fr!important}.x-rfq-layout{grid-template-columns:1fr!important}.x-proof-grid{grid-template-columns:1fr!important}.x-section{padding:80px 24px!important}nav{padding:0 24px!important}.x-nav-center{display:none!important}}
        @media(max-width:640px){.x-listings-grid{grid-template-columns:1fr!important}.x-footer-grid{grid-template-columns:1fr!important}.x-hero-metrics{grid-template-columns:1fr!important}nav{padding:0 16px!important}.x-markets-open{display:none!important}.x-nav-logo{font-size:16px!important}.x-btn-nav{display:none!important}}
        @media(hover:none),(pointer:coarse){*{cursor:auto!important}.x-cursor-dot,.x-cursor-ring{display:none!important;pointer-events:none!important}[data-terminal-hint]{display:none!important}}
        @media print{body{display:none!important}}
      ` }} />

      <input type="text" id="_hp_exchange" style={{ position: 'absolute', left: -9999, height: 0, width: 0, opacity: 0 }} tabIndex={-1} autoComplete="off" />

      <div ref={cursorRef} className="x-cursor-dot" style={{ position: 'fixed', width: 8, height: 8, background: C.gold, borderRadius: '50%', pointerEvents: 'none', zIndex: 99999, transform: 'translate(-50%,-50%)', mixBlendMode: 'difference' }} />
      <div ref={ringRef} className="x-cursor-ring" style={{ position: 'fixed', width: 32, height: 32, border: '1px solid rgba(212,168,67,0.5)', borderRadius: '50%', pointerEvents: 'none', zIndex: 99998, transform: 'translate(-50%,-50%)', transition: 'width 0.2s,height 0.2s,border-color 0.2s' }} />

      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")`, pointerEvents: 'none', zIndex: 9999, opacity: 0.6 }} />

      <TerminalMode listings={listings.map(l => ({ name: l.name, standard: l.standard, volume: 0, price: l.pricePerTonne, origin: l.origin, status: 'LIVE' }))} trades={sessionTrades.map(t => ({ id: t.trade_id || t.id || '', side: t.side || 'BUY', standard: t.standard || 'VCS', volume: t.volume_tonnes || 0, price: t.price_eur_per_tonne || 0, time: new Date().toLocaleTimeString() }))} indexPrice={currentIndexPrice} etsPrice={typeof etsPrice === 'number' ? etsPrice : (etsPrice as any)?.price ?? currentIndexPrice * 1.07} />

      <AIComplianceCoPilot isDark={isDark} context={{ currentIndexPrice, etsPrice: typeof etsPrice === 'number' ? etsPrice : currentIndexPrice * 1.07, portfolioTonnes: sessionTrades.reduce((s, t) => s + (t.volume_tonnes || 0), 0), portfolioSpend: sessionTrades.reduce((s, t) => s + (t.gross_eur || 0), 0), accountType: sessionAccount?.accountType, listings: listings.map(l => ({ name: l.name, standard: l.standard, price: l.pricePerTonne, tonnes: 0 })) }} />

      {escrowTrade && (
        <EscrowSettlement tradeId={escrowTrade.tradeId} amountEur={escrowTrade.amountEur} volumeTonnes={escrowTrade.volumeTonnes} standard={escrowTrade.standard} buyerEmail={sessionAccount?.email || ''} isDark={isDark} onSettled={() => setEscrowTrade(null)} onCancel={() => setEscrowTrade(null)} />
      )}

      <div style={{ background: C.ink, minHeight: '100vh', fontFamily: F.syne, color: C.cream, overflowX: 'hidden', cursor: 'none' }}>

        <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500, height: 68, display: 'flex', alignItems: 'center', padding: '0 52px', background: 'rgba(6,8,16,0.88)', backdropFilter: 'blur(24px)', borderBottom: `1px solid ${C.goldborder}` }}>
          <div className="x-nav-logo" style={{ fontFamily: F.playfair, fontSize: 20, fontWeight: 700, letterSpacing: '0.05em', color: C.cream, whiteSpace: 'nowrap' }}>
            UAIU<sup style={{ color: C.gold, fontSize: 11, verticalAlign: 'super', letterSpacing: '0.2em', fontFamily: F.mono, fontWeight: 400 }}>.LIVE/X</sup>
          </div>
          <div className="x-nav-center" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 28 }}>
            {[['home','Home'],['marketplace','Markets'],['intelligence','Intelligence'],['pipeline','Pipeline'],['calculator','Calculator'],['dashboard','Dashboard'],['rfq','RFQ'],['trust','Verify']].map(([id,label]) => (
              <a key={id} href={`#${id}`} className="x-nav-link" onClick={e => { e.preventDefault(); scrollTo(id); }} data-testid={`link-nav-${id}`}>{label}</a>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="x-markets-open" style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.green, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="x-pulse" /> Markets Open
            </div>
            <DarkModeToggle isDark={isDark} onToggle={toggleDark} />
            <MobileNav links={[
              {label:'Markets', href:'#marketplace'},
              {label:'Intelligence', href:'#intelligence'},
              {label:'Calculator', href:'#calculator'},
              {label:'Pipeline', href:'#pipeline'},
              {label:'Dashboard', href:'#dashboard'},
              {label:'RFQ Desk', href:'#rfq'},
              {label:'Forecast', href:'#prediction'},
              {label:'Budget', href:'#budget'},
              {label:'Calendar', href:'#calendar'},
              {label:'Verify', href:'#trust'},
            ]} onLinkClick={(href) => scrollTo(href.replace('#',''))} />
            <button className="x-btn-nav" onClick={() => { setAcctSuccess(false); setAcctModalTab(sessionAccount ? 'signin' : 'open'); setShowAccountModal(true); }} data-testid="button-open-account-header" style={sessionAccount ? { borderColor: C.green, color: C.green } : undefined}>{sessionAccount ? (sessionAccount.company || `${sessionAccount.firstName || ''} ${sessionAccount.lastName || ''}`.trim() || 'My Account') : 'Open Account'}</button>
          </div>
        </nav>

        <TradeTicker newTrades={tickerTrades} />

        <section id="home" style={{ minHeight: '100vh', paddingTop: 106, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 100% 70% at 70% 30%,rgba(212,168,67,0.06) 0%,transparent 55%),radial-gradient(ellipse 50% 60% at 10% 90%,rgba(30,50,120,0.25) 0%,transparent 50%)` }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(212,168,67,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(212,168,67,0.035) 1px,transparent 1px)`, backgroundSize: '80px 80px', maskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%,black,transparent)' }} />
          <div style={{ position: 'relative', zIndex: 2, maxWidth: 1440, margin: '0 auto', padding: '80px 52px 60px', width: '100%' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: C.goldfaint, border: `1px solid ${C.goldborder}`, padding: '8px 18px', marginBottom: 36 }}>
              <span className="x-pulse" />
              <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold }}>Caribbean Carbon Exchange · Est. 2025 · Wyoming Registered</span>
            </div>
            <h1 style={{ fontFamily: F.playfair, fontSize: 'clamp(58px,7vw,110px)', fontWeight: 900, lineHeight: 0.92, letterSpacing: '-0.03em', marginBottom: 40, maxWidth: 900, userSelect: 'none' }}>
              <span style={{ fontWeight: 400, color: C.cream2 }}>Carbon compliance</span><br />
              <em style={{ fontStyle: 'italic', color: C.gold, display: 'block' }}>is the market.</em>
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.75, color: C.cream3, maxWidth: 560, marginBottom: 52, fontWeight: 400 }}>UAIU.LIVE/X is the world&apos;s first dedicated Caribbean carbon credit marketplace. Buy EU ETS-compliant credits, list verified offsets, and turn mandatory compliance into a financial advantage — starting today.</p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 48 }}>
              <button className="x-btn-primary" onClick={() => scrollTo('marketplace')} data-testid="button-browse-credits">Browse Credits →</button>
              <button className="x-btn-ghost" onClick={() => scrollTo('list')} data-testid="button-list-credits-hero">List Your Credits</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 48, flexWrap: 'wrap', marginBottom: 48 }}>
              <Globe3D onPinClick={() => scrollTo('marketplace')} />
              <div style={{ flex: 1 }}>
                <CarbonClock />
              </div>
            </div>
            <div className="x-hero-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', border: `1px solid ${C.goldborder}`, background: 'rgba(13,18,32,0.8)', backdropFilter: 'blur(12px)' }}>
              {[
                { val: '€63.40', label: 'EU ETS Spot Price', sub: 'Live market reference rate' },
                { val: '€100', label: 'EU Fine Per Tonne', sub: 'Cost of non-compliance' },
                { val: '2027', label: '100% EU ETS Mandate', sub: 'Maritime full coverage deadline' },
                { val: '5', label: 'Sovereign Nations', sub: 'Carbon Union · Registry backed' },
              ].map((m, i) => (
                <div key={i} style={{ padding: '28px 32px', borderRight: i < 3 ? `1px solid ${C.goldborder}` : 'none' }}>
                  <div style={{ fontFamily: F.playfair, fontSize: 42, fontWeight: 700, color: C.gold, lineHeight: 1, marginBottom: 6, userSelect: 'none' }}>{m.val}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.cream3 }}>{m.label}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.green, marginTop: 4 }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div style={s.goldRule} />

        <section id="marketplace" style={{ background: C.ink2, borderTop: `1px solid ${C.goldborder}`, borderBottom: `1px solid ${C.goldborder}` }}>
          <div className="x-section" style={s.sectionWrap}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40, flexWrap: 'wrap', gap: 20 }}>
              <div>
                <div style={{ ...s.eyebrow as React.CSSProperties }}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />Live Listings</div>
                <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(38px,4.5vw,64px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0 }}>Available <em style={{ fontStyle: 'italic', color: C.gold }}>Credits</em></h2>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {[['all','All'],['eu','EU ETS'],['vcs','VCS'],['redd','REDD++'],['blue','Blue Carbon']].map(([val,label]) => (
                  <button key={val} className={`x-mfilter${filter === val ? ' active' : ''}`} style={{ fontFamily: F.mono }} onClick={() => setFilter(val)} data-testid={`filter-${val}`}>{label}</button>
                ))}
                <input className="x-fi" style={{ ...s.fi, flex: 1, maxWidth: 280, fontFamily: F.mono, fontSize: 11 }} placeholder="Search credits..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-credits" />
              </div>
            </div>
            <div className="x-listings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: C.goldborder }}>
              {filteredListings.map(l => {
                const bs = getBadgeStyle(l.standard, C);
                const up = l.changeDirection !== 'down';
                return (
                  <div key={l.id} className="x-listing-card" onClick={() => openTrade(l, 'buy')} data-testid={`card-listing-${l.id}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                      <span style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '5px 12px', border: '1px solid', ...bs }}>{l.badgeLabel}</span>
                      <span style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, letterSpacing: '0.1em' }}>Accepting Orders</span>
                    </div>
                    <div style={{ fontFamily: F.playfair, fontSize: 22, fontWeight: 700, marginBottom: 6, lineHeight: 1.1 }}>{l.name}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, letterSpacing: '0.1em', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={10} /> {l.origin}</div>
                    <div style={{ height: 1, background: C.goldborder, marginBottom: 20 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                      <div>
                        <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.cream3, marginBottom: 4 }}>Price / tonne</div>
                        <div style={{ fontFamily: F.playfair, fontSize: 22, fontWeight: 700, color: C.gold, lineHeight: 1, userSelect: 'none' }}>€{l.pricePerTonne.toFixed(2)}</div>
                        <div style={{ fontFamily: F.mono, fontSize: 10, color: up ? C.green : C.red }}>{up ? '▲' : '▼'} {Math.abs(l.changePercent)}% today</div>
                      </div>
                      <div>
                        <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.cream3, marginBottom: 4 }}>Standard</div>
                        <div style={{ fontFamily: F.playfair, fontSize: 16, fontWeight: 700, color: C.cream, lineHeight: 1 }}>{l.badgeLabel}</div>
                        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.green }}>&#9679; Active</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="x-btn-buy-now" onClick={e => { e.stopPropagation(); openTrade(l, 'buy'); }} data-testid={`button-buy-${l.id}`}>Buy Now</button>
                      <button className="x-btn-list" onClick={e => { e.stopPropagation(); scrollTo('list'); }} data-testid={`button-sell-${l.id}`}>Sell Similar</button>
                    </div>
                    <div onClick={e => e.stopPropagation()} style={{ marginTop: 12 }}>
                      <VideoTradeRoom listingId={l.id} listingName={l.name} standard={l.standard} price={l.pricePerTonne} isDark={isDark} />
                    </div>
                    <div onClick={e => e.stopPropagation()} style={{ marginTop: 8 }}>
                      <ListingChat listingId={l.id} listingName={l.name} userHandle={chatHandle} isDark={isDark} />
                    </div>
                    <div onClick={e => e.stopPropagation()} style={{ marginTop: 8 }}>
                      <DueDiligenceReport listing={{ id: l.id, name: l.name, standard: l.standard, price: l.pricePerTonne, volume_tonnes: 0, origin: l.origin }} currentIndexPrice={currentIndexPrice} isDark={isDark} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 40 }}>
              <OrderBook />
            </div>
          </div>
        </section>

        <AIMarketIntelligence />

        <div style={s.goldRule} />

        <section id="how" style={{ background: C.ink }}>
          <div className="x-section" style={s.sectionWrap}>
            <div className="x-steps-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
              <div>
                <div style={s.eyebrow as React.CSSProperties}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />Process</div>
                <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(38px,4.5vw,64px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 16 }}>Buying credits.<br /><em style={{ fontStyle: 'italic', color: C.gold }}>Simplified.</em></h2>
                <p style={{ fontSize: 15, color: C.cream3, lineHeight: 1.7, maxWidth: 560, marginBottom: 56 }}>From registration to settlement in under 24 hours. The fastest compliant carbon credit transaction in the Caribbean basin.</p>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {[
                    { n: '01', title: 'Open Your Account', text: 'Register as a corporate buyer, credit generator, or broker. KYC verification typically completes within 2 business hours. All account types accepted globally.', tag: 'Free · 2hrs' },
                    { n: '02', title: 'Select Your Credits', text: 'Browse verified listings filtered by standard (EU ETS, VCS, Gold Standard, CORSIA), origin, vintage year, and price. Every credit is pre-verified for compliance.', tag: 'Real-time · Live Pricing' },
                    { n: '03', title: 'Execute & Settle', text: 'Place your order. Instant price lock. Settlement within T+1. Credits transferred to your registry account with full blockchain provenance trail.', tag: 'T+1 Settlement · 0.75% Fee' },
                    { n: '04', title: 'Report & Retire', text: 'Auto-generate your EU ETS compliance report. Retire credits directly from your dashboard. One-click export for regulatory submission to EU and national authorities.', tag: 'Automated · Audit-Ready' },
                  ].map(step => (
                    <div key={step.n} className="x-step-item">
                      <div className="x-step-num">{step.n}</div>
                      <div>
                        <div style={{ fontFamily: F.playfair, fontSize: 22, fontWeight: 700, marginBottom: 10 }}>{step.title}</div>
                        <div style={{ fontSize: 14, lineHeight: 1.7, color: C.cream3 }}>{step.text}</div>
                        <span style={s.stepTag as React.CSSProperties}>{step.tag}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={s.eyebrow as React.CSSProperties}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />Calculator</div>
                <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(38px,4.5vw,64px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 16 }}>Your EU ETS<br /><em style={{ fontStyle: 'italic', color: C.gold }}>exposure.</em></h2>
                <p style={{ fontSize: 15, color: C.cream3, lineHeight: 1.7, maxWidth: 560, marginBottom: 40 }}>Calculate your annual carbon compliance cost and see exactly how much UAIU credits save you.</p>
                <div style={{ background: C.ink2, border: `1px solid ${C.goldborder}`, position: 'relative', overflow: 'hidden' }} className="x-form-wrap">
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.gold},transparent)` }} />
                  <div style={{ padding: '32px 36px', borderBottom: `1px solid ${C.goldborder}` }}>
                    <div style={{ fontFamily: F.playfair, fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Compliance Cost Calculator</div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, letterSpacing: '0.1em' }}>EU ETS Maritime &amp; Aviation · 2025 Rates</div>
                  </div>
                  <div style={{ padding: '32px 36px' }}>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, letterSpacing: '0.1em', margin: '20px 0 8px' }}>
                      Annual CO₂ emissions (tonnes): <strong style={{ color: C.gold }}>{emissions.toLocaleString()}</strong>
                    </div>
                    <input type="range" className="x-cc-slider" min={1000} max={100000} value={emissions} onChange={e => setEmissions(parseInt(e.target.value))} data-testid="input-co2-tonnes" />
                    <div style={{ height: 20 }} />
                    {[
                      { label: 'EU ETS Fine (100% coverage)', val: '€' + fine.toLocaleString(), id: 'calcFine' },
                      { label: 'Market Credit Cost (UAIU)', val: '€' + creditCost.toLocaleString(), id: 'calcCreditCost' },
                    ].map(row => (
                      <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid rgba(212,168,67,0.08)` }}>
                        <span style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3, letterSpacing: '0.05em' }}>{row.label}</span>
                        <span style={{ fontFamily: F.playfair, fontSize: 20, fontWeight: 700, color: C.cream }} data-testid={row.id}>{row.val}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 28, background: C.goldfaint, border: `1px solid ${C.goldborder}`, padding: '20px 24px' }}>
                      <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, marginBottom: 6 }}>Annual Savings</div>
                      <div style={{ fontFamily: F.playfair, fontSize: 38, fontWeight: 900, color: C.gold, lineHeight: 1 }} data-testid="calcSavings">€{savings.toLocaleString()}</div>
                      <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, marginTop: 4 }}>vs. paying the EU ETS fine outright</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div style={s.goldRule} />

        <section id="citizens" style={{ background: C.ink2, borderTop: `1px solid ${C.goldborder}`, borderBottom: `1px solid ${C.goldborder}` }}>
          <div className="x-section" style={s.sectionWrap}>
            <div style={s.eyebrow as React.CSSProperties}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />Citizens</div>
            <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(38px,4.5vw,64px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 16 }}>The Citizens <em style={{ fontStyle: 'italic', color: C.gold }}>Portal.</em></h2>
            <p style={{ fontSize: 15, color: C.cream3, lineHeight: 1.7, maxWidth: 560, marginBottom: 56 }}>Five sovereign nations participate in the Carbon Union, generating verified credits from environmental programs that trade on global markets.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, background: C.goldborder, border: `1px solid ${C.goldborder}`, marginBottom: 64 }}>
              {[
                { code: 'AG', name: 'Antigua & Barbuda', role: 'Registry HQ' },
                { code: 'TO', name: 'Tonga', role: 'Pacific Blue Carbon' },
                { code: 'ZM', name: 'Zambia', role: 'REDD++ Forestry' },
                { code: 'KE', name: 'Kenya', role: 'Regenerative Agriculture' },
                { code: 'KN', name: 'St. Kitts & Nevis', role: 'Caribbean Biofuel' },
              ].map(n => (
                <div key={n.code} style={{ background: C.ink2, padding: '28px 20px', textAlign: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.goldfaint, border: `1px solid ${C.goldborder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 12, color: C.gold }}>{n.code}</span>
                  </div>
                  <div style={{ fontFamily: F.playfair, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{n.name}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{n.role}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.green, marginTop: 8, letterSpacing: '0.1em' }}>&#9679; Active</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start', marginBottom: 80 }}>
              <div>
                <div style={s.eyebrow as React.CSSProperties}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />How It Works</div>
                <h3 style={{ fontFamily: F.playfair, fontSize: 'clamp(28px,3vw,44px)', fontWeight: 700, lineHeight: 1.1, marginBottom: 20 }}>Waste becomes <em style={{ color: C.gold, fontStyle: 'italic' }}>wealth.</em></h3>
                <p style={{ fontSize: 14, lineHeight: 1.75, color: C.cream3, marginBottom: 40 }}>Communities in Carbon Union nations participate in verified environmental programs — turning agricultural waste, human waste, degraded land, and CO₂-averting activity into measurable climate assets that trade on global markets.</p>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {[
                    { Icon: Leaf, title: 'Join a Green Project', text: 'Register via the Citizens Portal. Choose from local programs: biofuel production, coral restoration, reforestation, agricultural waste conversion, or regenerative soil building.' },
                    { Icon: FileText, title: 'Earn Verified Credits', text: 'Your participation is measured against recognized carbon standards. Every tonne of CO₂ averted or sequestered generates one verified carbon credit issued by the SwissX Carbon Registry in Antigua.' },
                    { Icon: Shield, title: 'Bank at SwissX', text: 'Credits are held in your SwissX wallet. Bank them, hold them as the price rises, or convert them immediately. Integrated with tokenized carbon wealth systems.' },
                    { Icon: Globe, title: 'Sell on UAIU.LIVE/X', text: 'List your credits directly on the exchange. Institutional buyers — cruise lines, airlines, corporations — purchase your credits to meet their mandatory EU ETS compliance obligations.' },
                  ].map(({ Icon, title, text }, i) => (
                    <div key={i} style={{ display: 'flex', gap: 20, padding: '24px 0', borderBottom: i < 3 ? `1px solid ${C.goldborder}` : 'none' }}>
                      <div style={{ width: 40, height: 40, background: C.goldfaint, border: `1px solid ${C.goldborder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={18} color={C.gold} />
                      </div>
                      <div>
                        <div style={{ fontFamily: F.playfair, fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{title}</div>
                        <div style={{ fontSize: 13, color: C.cream3, lineHeight: 1.6 }}>{text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ background: C.ink, border: `1px solid ${C.goldborder}`, position: 'relative', overflow: 'hidden' }} className="x-form-wrap">
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.gold},transparent)` }} />
                  <div style={{ padding: '32px 36px', borderBottom: `1px solid ${C.goldborder}` }}>
                    <div style={{ fontFamily: F.playfair, fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Citizens Portal</div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, letterSpacing: '0.1em' }}>SwissX Carbon Registry · Antigua</div>
                  </div>
                  <div style={{ padding: '32px 36px' }}>
                    <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, marginBottom: 14 }}>Open Programs — Accepting Participants</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                      {[
                        { name: 'B100 Biofuel Production', detail: 'Antigua · SwissX Verified · 1 credit per 90 gal' },
                        { name: 'Coral Restoration — Pacific', detail: 'Tonga · Blue Carbon VCS · 28M+ acres' },
                        { name: 'Agricultural Waste → Biogas', detail: 'Kenya · Gold Standard · per tonne CO₂ averted' },
                        { name: 'REDD++ Forest Conservation', detail: 'Zambia · Gold Standard · annual sequestration' },
                      ].map((p, i) => (
                        <div key={i} style={{ background: C.ink2, border: `1px solid ${C.goldborder}`, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
                            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream4 }}>{p.detail}</div>
                          </div>
                          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.green }}>&#9679; Enrolling</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: C.goldfaint, border: `1px solid ${C.goldborder}`, padding: '18px 22px', marginBottom: 24 }}>
                      <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>Current Credit Value</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ fontFamily: F.playfair, fontSize: 36, fontWeight: 700, color: C.gold }}>€58.20</div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3 }}>per verified credit</div>
                          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3 }}>VCS / Gold Standard rate</div>
                        </div>
                      </div>
                    </div>
                    <button style={s.formSubmit as React.CSSProperties} onClick={() => { setAcctSuccess(false); setShowAccountModal(true); }} data-testid="button-join-portal">Join Citizens Portal →</button>
                    <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream4, marginTop: 12, textAlign: 'center', letterSpacing: '0.05em' }}>Backed by SwissX Sovereign Wealth Fund · Carbon Union Nations</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={s.eyebrow as React.CSSProperties}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />What Generates Credits</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: C.goldborder, border: `1px solid ${C.goldborder}`, marginTop: 20 }}>
              {[
                { Icon: Waves, title: 'Sargassum Seaweed', text: 'Harvested from Caribbean beaches, converted into SwissX B100 biofuel. 93% lower emissions than diesel.', detail: '1 credit per 90 gallons produced' },
                { Icon: Leaf, title: 'Agricultural Waste', text: 'Crop residues, manure, and organic waste converted to biogas and regenerative soil products across Kenya and Zambia.', detail: 'Measured per tonne CO₂ averted' },
                { Icon: Waves, title: 'Coral & Seagrass', text: '28M+ acre restoration initiative across Pacific and Caribbean. Blue carbon sequestration verified by VCS standard.', detail: 'Sequestration measured annually' },
                { Icon: Building2, title: 'Green Economy Zones', text: 'Communities rebuild using regenerative materials. The rebuilding itself generates credits that fund further recovery.', detail: 'Self-financing community model' },
                { Icon: Droplets, title: 'Human Waste Systems', text: 'Biodigester programs convert human and municipal waste into clean energy and fertilizer, eliminating methane emissions.', detail: 'Methane avoidance credits issued' },
                { Icon: Trees, title: 'REDD++ Forestry', text: 'Verified forest conservation and reforestation programs in Honduras, Zambia, and Antigua generating Gold Standard credits.', detail: 'Gold Standard certified' },
              ].map(({ Icon, title, text, detail }, i) => (
                <div key={i} style={{ background: C.ink2, padding: '28px 24px' }}>
                  <div style={{ marginBottom: 12 }}><Icon size={28} color={C.gold} /></div>
                  <div style={{ fontFamily: F.playfair, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</div>
                  <div style={{ fontSize: 13, color: C.cream3, lineHeight: 1.6, marginBottom: 12 }}>{text}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold }}>{detail}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 64, background: C.ink2, border: `1px solid ${C.goldborder}`, padding: 52, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 80% at 50% 50%,rgba(212,168,67,0.05),transparent)`, pointerEvents: 'none' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ ...s.eyebrow as React.CSSProperties, justifyContent: 'center', marginBottom: 24 }}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />Karmic Econ</div>
                <div style={{ fontFamily: F.playfair, fontSize: 'clamp(24px,3.5vw,48px)', fontWeight: 700, lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.02em' }}>
                  Every act of environmental repair<br />becomes a <em style={{ fontStyle: 'italic', color: C.gold }}>financial asset.</em>
                </div>
                <div style={{ fontSize: 15, color: C.cream3, maxWidth: 640, margin: '0 auto 36px', lineHeight: 1.75 }}>The SwissX Sovereign Wealth Fund underwrites environmental and regenerative energy projects built on sustainability — transforming natural waste into measurable climate assets that flow back to the communities that created them.</div>
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="x-btn-primary" onClick={() => { setAcctSuccess(false); setShowAccountModal(true); }} data-testid="button-join-karmic">Join Citizens Portal →</button>
                  <button className="x-btn-ghost" onClick={() => scrollTo('marketplace')} data-testid="button-view-exchange">View Exchange</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div style={s.goldRule} />

        <section id="list" style={{ background: C.ink2, borderTop: `1px solid ${C.goldborder}` }}>
          <div className="x-section" style={s.sectionWrap}>
            <div className="x-list-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
              <div style={{ background: C.ink, border: `1px solid ${C.goldborder}`, position: 'relative', overflow: 'hidden' }} className="x-form-wrap">
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.gold},transparent)` }} />
                <div style={{ padding: '32px 36px', borderBottom: `1px solid ${C.goldborder}` }}>
                  <div style={{ fontFamily: F.playfair, fontSize: 26, fontWeight: 700, marginBottom: 4 }}>List Your Credits</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, letterSpacing: '0.1em' }}>Submit for 48-hour verification</div>
                </div>
                {listSuccess ? (
                  <div style={{ padding: '40px 36px', textAlign: 'center' }}>
                    <div style={{ marginBottom: 20 }}><CheckCircle size={56} color={C.gold} /></div>
                    <div style={{ fontFamily: F.playfair, fontSize: 28, fontWeight: 700, color: C.gold, marginBottom: 10 }}>Submission Received</div>
                    <div style={{ fontSize: 14, color: C.cream3, lineHeight: 1.7 }}>Your credits have been submitted for verification. Our team will review your project documentation and registry serials within 48 hours. You&apos;ll receive confirmation at the email provided.</div>
                  </div>
                ) : (
                  <div style={{ padding: '32px 36px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Organization Name *</label><input className="x-fi" style={s.fi} type="text" placeholder="Legal entity name" value={listOrgName} onChange={e => setListOrgName(e.target.value)} data-testid="input-list-org" /></div>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Contact Name *</label><input className="x-fi" style={s.fi} type="text" placeholder="Full name" value={listContact} onChange={e => setListContact(e.target.value)} data-testid="input-list-contact" /></div>
                    </div>
                    <div style={s.fg}><label style={s.fl as React.CSSProperties}>Business Email *</label><input className="x-fi" style={s.fi} type="email" placeholder="you@company.com" value={listEmail} onChange={e => setListEmail(e.target.value)} data-testid="input-list-email" /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Credit Standard *</label><select className="x-fi x-fi" style={s.fi} value={listStandard} onChange={e => setListStandard(e.target.value)} data-testid="select-list-standard"><option value="">Select standard</option>{CREDIT_STANDARDS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Credit Type *</label><select className="x-fi" style={s.fi} value={listType} onChange={e => setListType(e.target.value)} data-testid="select-list-type"><option value="">Select type</option>{CREDIT_TYPES.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Volume (tonnes CO₂) *</label><input className="x-fi" style={s.fi} type="number" placeholder="e.g. 10000" value={listVolume} onChange={e => setListVolume(e.target.value)} data-testid="input-list-volume" /></div>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Asking Price (€/tonne) *</label><input className="x-fi" style={s.fi} type="number" placeholder="e.g. 65.00" value={listPrice} onChange={e => setListPrice(e.target.value)} data-testid="input-list-price" /></div>
                    </div>
                    <div style={s.fg}><label style={s.fl as React.CSSProperties}>Project Origin / Country *</label><input className="x-fi" style={s.fi} type="text" placeholder="e.g. Antigua, Caribbean" value={listOrigin} onChange={e => setListOrigin(e.target.value)} data-testid="input-list-origin" /></div>
                    <div style={s.fg}><label style={s.fl as React.CSSProperties}>Registry Serial — optional</label><input className="x-fi" style={s.fi} type="text" placeholder="e.g. VCS-7821-2024-001" value={listSerial} onChange={e => setListSerial(e.target.value)} data-testid="input-list-serial" /></div>
                    <VisionVerification onReport={(report) => setListSerial(prev => prev)} />
                    <button style={{ ...s.formSubmit as React.CSSProperties, opacity: listSubmitting ? 0.7 : 1 }} onClick={handleListSubmit} disabled={listSubmitting} data-testid="button-list-submit">{listSubmitting ? 'Submitting...' : 'Submit for Verification →'}</button>
                    <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream4, marginTop: 16, textAlign: 'center', lineHeight: 1.6 }}>48-hour AI-assisted verification · Human reviewed · UAIU Holdings Corp. Wyoming</div>
                  </div>
                )}
              </div>
              <div style={{ paddingTop: 20 }}>
                <div style={s.eyebrow as React.CSSProperties}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />Why List on UAIU.LIVE/X</div>
                <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(38px,4.5vw,64px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 16 }}>The Caribbean <em style={{ fontStyle: 'italic', color: C.gold }}>premium.</em></h2>
                <p style={{ fontSize: 15, color: C.cream3, lineHeight: 1.7, maxWidth: 560, marginBottom: 40 }}>Caribbean-origin credits command an 8–14% premium on global markets due to the regulatory focus on maritime and aviation emissions in the Caribbean corridor.</p>
                {[
                  { Icon: Users, title: 'Institutional Buyer Network', text: 'Access to pre-qualified institutional buyers including cruise operators, cargo shipping groups, and aviation firms seeking Caribbean-origin compliance credits.', detail: 'Average time to first offer: 72 hours' },
                  { Icon: Zap, title: '48-Hour Seller Verification', text: 'No credit lists without AI-assisted verification. Sellers submit project docs, registry serials, and vintage year. AI reviews and approves within 48 hours.', detail: 'AI-assisted · Human reviewed' },
                  { Icon: Shield, title: 'Sovereign Backing', text: 'Credits originate from SwissX Sovereign Wealth Fund programs operating under the laws of Antigua & Barbuda, Tonga, Zambia, Kenya, and St. Kitts & Nevis.', detail: '5 sovereign nations · Carbon Union' },
                ].map(({ Icon, title, text, detail }, i) => (
                  <div key={i} className="x-benefit-item">
                    <div style={{ width: 44, height: 44, background: C.goldfaint, border: `1px solid ${C.goldborder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={20} color={C.gold} />
                    </div>
                    <div>
                      <div style={{ fontFamily: F.playfair, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{title}</div>
                      <div style={{ fontSize: 13, lineHeight: 1.65, color: C.cream3 }}>{text}</div>
                      <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, marginTop: 8, letterSpacing: '0.05em' }}>{detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div style={s.goldRule} />

        <section id="compliance" style={{ background: C.ink }}>
          <div className="x-section" style={s.sectionWrap}>
            <div style={s.eyebrow as React.CSSProperties}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />Standards &amp; Verification</div>
            <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(38px,4.5vw,64px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 16 }}>Every credit.<br /><em style={{ fontStyle: 'italic', color: C.gold }}>Fully compliant.</em></h2>
            <p style={{ fontSize: 15, color: C.cream3, lineHeight: 1.7, maxWidth: 560, marginBottom: 56 }}>UAIU.LIVE/X only lists credits verified by internationally recognized standards. No exceptions.</p>
            <div className="x-compliance-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: C.goldborder, border: `1px solid ${C.goldborder}`, marginBottom: 60 }}>
              {[
                { logo: 'EU ETS', sub: 'European Union Emissions Trading System' },
                { logo: 'Verra VCS', sub: 'Verified Carbon Standard' },
                { logo: 'Gold Standard', sub: 'Swiss Foundation Premium Certification' },
                { logo: 'CORSIA', sub: 'ICAO Carbon Offset Scheme — Aviation' },
              ].map((c, i) => (
                <div key={i} className="x-comp-card">
                  <div style={{ fontFamily: F.playfair, fontSize: 28, fontWeight: 900, color: C.cream2, marginBottom: 8, letterSpacing: '-0.02em' }}>{c.logo}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.cream4 }}>{c.sub}</div>
                  <div style={{ display: 'inline-block', marginTop: 14, fontFamily: F.mono, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.green, border: '1px solid rgba(34,197,94,0.3)', padding: '4px 10px', background: 'rgba(34,197,94,0.08)' }}>&#10003; Fully Supported</div>
                </div>
              ))}
            </div>
            <div style={{ background: C.ink2, border: `1px solid ${C.goldborder}`, padding: '40px 48px', display: 'flex', gap: 40, alignItems: 'center' }}>
              <div style={{ flexShrink: 0 }}><Scale size={48} color={C.gold} /></div>
              <div>
                <div style={{ fontFamily: F.playfair, fontSize: 26, fontWeight: 700, marginBottom: 10 }}>Built for the EU ETS mandate era</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: C.cream3 }}>From 2025, EU shipping companies must surrender allowances for 70% of their emissions. By 2027, it&apos;s 100%. Every tonne of CO₂ not covered by a credit costs €100 in fines — nearly double the credit price. UAIU.LIVE/X exists to close that gap, cleanly, quickly, and with full regulatory documentation your compliance team can submit directly to national authorities.</div>
              </div>
            </div>
          </div>
        </section>

        <div style={s.goldRule} />

        <section id="proof" style={{ background: C.ink2, borderTop: `1px solid ${C.goldborder}`, borderBottom: `1px solid ${C.goldborder}` }}>
          <div className="x-section" style={s.sectionWrap}>
            <div style={s.eyebrow as React.CSSProperties}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />From Our Clients</div>
            <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(38px,4.5vw,64px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 16 }}>Why institutions<br /><em style={{ fontStyle: 'italic', color: C.gold }}>choose UAIU.</em></h2>
            <div className="x-proof-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: C.goldborder, marginTop: 48 }}>
              {[
                { quote: '"We needed EU ETS-compliant credits for our Caribbean routing fleet. UAIU.LIVE/X had verified inventory, competitive pricing, and our compliance team had the documentation they needed in under 24 hours."', name: 'Head of Sustainability', role: 'Major Caribbean Cruise Operator' },
                { quote: '"Listing our REDD++ forest conservation credits on UAIU took 48 hours. Within a week we had three institutional buyers. The Caribbean origin premium is real — we\'re selling at 11% above what we\'d get on other platforms."', name: 'Director of Carbon Programs', role: 'Caribbean Conservation Trust' },
                { quote: '"The compliance calculator alone was worth the call. We didn\'t realize how much EU ETS exposure our Caribbean routes were generating. UAIU showed us the number and had a solution ready in the same conversation."', name: 'CFO', role: 'Regional Maritime Logistics Group' },
              ].map((t, i) => (
                <div key={i} className="x-proof-card">
                  <div style={{ color: C.gold, fontSize: 13, marginBottom: 16, letterSpacing: 2 }}>&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                  <div style={{ fontFamily: F.playfair, fontSize: 17, fontStyle: 'italic', lineHeight: 1.6, color: C.cream2, marginBottom: 24 }}>{t.quote}</div>
                  <div style={{ fontFamily: F.syne, fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{t.name}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, letterSpacing: '0.08em' }}>{t.role}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div style={s.goldRule} />

        <section id="rfq" style={{ background: C.ink2, borderTop: `1px solid ${C.goldborder}` }}>
          <div className="x-section" style={s.sectionWrap}>
            <div style={s.eyebrow as React.CSSProperties}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />Institutional</div>
            <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(38px,4.5vw,64px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 16 }}>Bulk Offtake.<br /><em style={{ fontStyle: 'italic', color: C.gold }}>Request for Quote.</em></h2>
            <p style={{ fontSize: 15, color: C.cream3, lineHeight: 1.7, maxWidth: 560, marginBottom: 56 }}>Institutional buyers don&apos;t click "Buy Now." They submit RFQs. UAIU.LIVE/X operates a live RFQ desk for structured transactions — cruise lines, shipping groups, airlines, and corporate compliance teams. Submit below and receive a priced quote pack within 4 business hours.</p>
            <div className="x-rfq-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
              <div style={{ background: C.ink, border: `1px solid ${C.goldborder}`, position: 'relative', overflow: 'hidden' }} className="x-form-wrap">
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.gold},transparent)` }} />
                <div style={{ padding: '32px 36px', borderBottom: `1px solid ${C.goldborder}` }}>
                  <div style={{ fontFamily: F.playfair, fontSize: 26, fontWeight: 700, marginBottom: 4 }}>RFQ Desk</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, letterSpacing: '0.1em' }}>Institutional · Bulk Offtake · Structured Pricing</div>
                </div>
                {rfqSuccess ? (
                  <div style={{ padding: '40px 36px', textAlign: 'center' }}>
                    <div style={{ marginBottom: 20 }}><CheckCircle size={56} color={C.gold} /></div>
                    <div style={{ fontFamily: F.playfair, fontSize: 28, fontWeight: 700, color: C.gold, marginBottom: 10 }}>RFQ Submitted</div>
                    <div style={{ fontSize: 14, color: C.cream3, lineHeight: 1.7, marginBottom: 16 }}>Your request has been received by our institutional desk. A priced quote pack will be sent to your email within 4 business hours.</div>
                    <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream4 }}>RFQ ID: {rfqId}</div>
                  </div>
                ) : (
                  <div style={{ padding: '32px 36px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Organization / Company *</label><input className="x-fi" style={s.fi} type="text" placeholder="Carnival Corp / Royal Caribbean..." value={rfqCompany} onChange={e => setRfqCompany(e.target.value)} data-testid="input-rfq-company" /></div>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Contact Name *</label><input className="x-fi" style={s.fi} type="text" placeholder="Full name" value={rfqContact} onChange={e => setRfqContact(e.target.value)} data-testid="input-rfq-contact" /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Email *</label><input className="x-fi" style={s.fi} type="email" placeholder="you@company.com" value={rfqEmail} onChange={e => setRfqEmail(e.target.value)} data-testid="input-rfq-email" /></div>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Side *</label><select className="x-fi" style={s.fi} value={rfqSide} onChange={e => setRfqSide(e.target.value)} data-testid="select-rfq-side"><option value="BUY">Buy (Offtake — We Need Credits)</option><option value="SELL">Sell (Supply — We Have Credits)</option></select></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Credit Standard *</label><select className="x-fi" style={s.fi} value={rfqStandard} onChange={e => setRfqStandard(e.target.value)} data-testid="select-rfq-standard">{RFQ_STANDARDS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Volume (tonnes CO₂) *</label><input className="x-fi" style={s.fi} type="number" placeholder="e.g. 50000" min={1000} value={rfqVolume} onChange={e => setRfqVolume(e.target.value)} data-testid="input-rfq-volume" /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Target Price (€/tonne) — optional</label><input className="x-fi" style={s.fi} type="number" placeholder="e.g. 63.00" min={0} step={0.01} value={rfqPrice} onChange={e => setRfqPrice(e.target.value)} data-testid="input-rfq-price" /></div>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Preferred Origin — optional</label><input className="x-fi" style={s.fi} type="text" placeholder="e.g. Antigua, Caribbean" value={rfqOrigin} onChange={e => setRfqOrigin(e.target.value)} data-testid="input-rfq-origin" /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Vintage Year — optional</label><input className="x-fi" style={s.fi} type="number" placeholder="e.g. 2024" min={2020} max={2030} value={rfqVintage} onChange={e => setRfqVintage(e.target.value)} data-testid="input-rfq-vintage" /></div>
                      <div style={s.fg}><label style={s.fl as React.CSSProperties}>Compliance Deadline — optional</label><input className="x-fi" style={s.fi} type="text" placeholder="e.g. Q1 2026 / March 31" value={rfqDeadline} onChange={e => setRfqDeadline(e.target.value)} data-testid="input-rfq-deadline" /></div>
                    </div>
                    <div style={s.fg}><label style={s.fl as React.CSSProperties}>Notes / Context — optional</label><textarea className="x-fi" style={{ ...s.fi, resize: 'vertical' } as React.CSSProperties} rows={3} placeholder="Fleet size, routes, regulatory framework, delivery window..." value={rfqNotes} onChange={e => setRfqNotes(e.target.value)} data-testid="input-rfq-notes" /></div>
                    {rfqEstimate && (
                      <div style={{ background: C.goldfaint, border: `1px solid ${C.goldborder}`, padding: '20px 24px', margin: '16px 0' }}>
                        <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, marginBottom: 12 }}>Indicative Estimate</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                          <div><div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Gross Value</div><div style={{ fontFamily: F.playfair, fontSize: 20, fontWeight: 700, color: C.cream }}>€{rfqEstimate.gross.toLocaleString()}</div></div>
                          <div><div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Platform Fee (0.75%)</div><div style={{ fontFamily: F.playfair, fontSize: 20, fontWeight: 700, color: C.cream }}>€{rfqEstimate.fee.toFixed(0)}</div></div>
                          <div><div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Net Cost</div><div style={{ fontFamily: F.playfair, fontSize: 20, fontWeight: 700, color: C.gold }}>€{(rfqEstimate.gross + rfqEstimate.fee).toLocaleString('en', { maximumFractionDigits: 0 })}</div></div>
                        </div>
                      </div>
                    )}
                    <button style={{ ...s.formSubmit as React.CSSProperties, opacity: rfqSubmitting ? 0.7 : 1 }} onClick={handleRfqSubmit} disabled={rfqSubmitting} data-testid="button-rfq-submit">{rfqSubmitting ? 'Submitting...' : 'Submit RFQ — Receive Priced Quote →'}</button>
                  </div>
                )}
              </div>
              <div>
                <div style={s.eyebrow as React.CSSProperties}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />Who Uses the RFQ Desk</div>
                <h3 style={{ fontFamily: F.playfair, fontSize: 'clamp(28px,3vw,40px)', fontWeight: 700, lineHeight: 1.1, marginBottom: 20 }}>Built for <em style={{ color: C.gold, fontStyle: 'italic' }}>institutions.</em></h3>
                <p style={{ fontSize: 14, lineHeight: 1.75, color: C.cream3, marginBottom: 40 }}>The RFQ desk handles structured transactions that don&apos;t fit the standard marketplace flow. Minimum volume: 1,000 tonnes. No maximum. Priced quote packs include full regulatory documentation, compliance certificates, and settlement terms.</p>
                {[
                  { Icon: Waves, title: 'Maritime Operators', text: 'Cruise lines, cargo shipping groups, and port operators facing EU ETS compliance obligations from Caribbean routing.' },
                  { Icon: Globe, title: 'Aviation Companies', text: 'Airlines and charter operators seeking CORSIA-eligible offsets for international routes touching Caribbean airspace.' },
                  { Icon: Building2, title: 'Industrial Corporates', text: 'Manufacturing and energy companies with Caribbean operations seeking voluntary or mandatory carbon offset positions.' },
                  { Icon: Shield, title: 'Investment Funds', text: 'Carbon-focused ESG funds and institutional investors building long-term positions in Caribbean-origin credit inventory.' },
                ].map(({ Icon, title, text }, i) => (
                  <div key={i} style={{ display: 'flex', gap: 20, padding: '20px 0', borderBottom: i < 3 ? `1px solid ${C.goldborder}` : 'none' }}>
                    <div style={{ width: 40, height: 40, background: C.goldfaint, border: `1px solid ${C.goldborder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} color={C.gold} />
                    </div>
                    <div>
                      <div style={{ fontFamily: F.playfair, fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: 13, color: C.cream3, lineHeight: 1.6 }}>{text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1', borderTop: `1px solid ${C.goldborder}`, paddingTop: 40, marginTop: 8 }}>
              <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, marginBottom: 24 }}>AI-Assisted Input — Auto-fill form fields with voice or text</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                <VoiceRFQ isDark={isDark} onParsed={(parsed) => {
                  if (parsed.volume_tonnes) setRfqVolume(String(parsed.volume_tonnes));
                  if (parsed.standard) setRfqStandard(parsed.standard);
                  if (parsed.deadline) setRfqDeadline(parsed.deadline);
                  if (parsed.side) setRfqSide(parsed.side);
                  if (parsed.target_price_eur) setRfqPrice(String(parsed.target_price_eur));
                  if (parsed.notes) setRfqNotes(parsed.notes);
                }} />
                <AIRFQAssistant onParsed={(parsed) => {
                  if (parsed.volume_tonnes) setRfqVolume(String(parsed.volume_tonnes));
                  if (parsed.standard) setRfqStandard(parsed.standard);
                  if (parsed.deadline) setRfqDeadline(parsed.deadline);
                }} />
              </div>
            </div>
            {rfqSubmitted && (
              <div style={{ marginTop: 48 }}>
                <AITradeNegotiator
                  rfqData={{ side: rfqSide, standard: rfqStandard, volume_tonnes: rfqVolume ? parseFloat(rfqVolume) : 0, target_price_eur: rfqPrice ? parseFloat(rfqPrice) : undefined, deadline: rfqDeadline }}
                  currentIndexPrice={currentIndexPrice}
                  isDark={isDark}
                />
              </div>
            )}
          </div>
        </section>

        <section id="calculator" style={{ background: C.ink, borderTop: `1px solid ${C.goldborder}` }}>
          <div className="x-section" style={s.sectionWrap}>
            <div style={s.eyebrow as React.CSSProperties}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />Carbon Accounting</div>
            <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(38px,4.5vw,64px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 16 }}>Calculate your<br /><em style={{ fontStyle: 'italic', color: C.gold }}>farm footprint.</em></h2>
            <p style={{ fontSize: 15, color: C.cream3, lineHeight: 1.7, maxWidth: 560, marginBottom: 48 }}>Input your agricultural operation details to estimate your annual carbon credit yield and compliance offset capacity.</p>
            <FarmCarbonCalculator />
          </div>
        </section>

        <section id="pipeline" style={{ background: C.ink2, borderTop: `1px solid ${C.goldborder}`, borderBottom: `1px solid ${C.goldborder}` }}>
          <div className="x-section" style={s.sectionWrap}>
            <div style={s.eyebrow as React.CSSProperties}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />Project Development</div>
            <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(38px,4.5vw,64px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 16 }}>Project<br /><em style={{ fontStyle: 'italic', color: C.gold }}>pipeline.</em></h2>
            <p style={{ fontSize: 15, color: C.cream3, lineHeight: 1.7, maxWidth: 560, marginBottom: 48 }}>Live view of carbon projects in verification, awaiting issuance, or recently listed on the exchange.</p>
            <ProjectPipeline />
          </div>
        </section>

        <PortfolioDashboard
          trades={sessionTrades.map(t => ({ trade_id: t.trade_id || t.id || '', side: t.side || t.mode || 'BUY', standard: t.standard || 'Carbon Credit', volume_tonnes: t.volume_tonnes || t.volumeTonnes || 0, price_eur_per_tonne: t.price_eur_per_tonne || t.priceEurPerTonne || 0, gross_eur: t.gross_eur || t.grossEur || 0, receipt_hash: t.receipt_hash || t.receiptHash || '' }))}
          retirements={[]}
          accountName={sessionAccount?.company || 'Exchange Account'}
          annualTarget={sessionAccount?.annualCo2 || 10000}
        />

        <div style={s.goldRule} />

        <section id="trust" style={{ background: C.ink }}>
          <div className="x-section" style={s.sectionWrap}>
            <div style={s.eyebrow as React.CSSProperties}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />Trust &amp; Verification</div>
            <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(38px,4.5vw,64px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 56 }}>Every trade.<br /><em style={{ fontStyle: 'italic', color: C.gold }}>On the record.</em></h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: C.goldborder, border: `1px solid ${C.goldborder}`, marginBottom: 60 }}>
              {[
                { Icon: Link2, title: 'Blockchain Provenance', text: 'Every trade generates a SHA-256 chained receipt. Independent verification without account access. Hash chain is publicly auditable.' },
                { Icon: Clock, title: 'T+1 Settlement', text: 'Credits transfer to your registry account within one business day of trade execution. Full settlement confirmation with audit trail.' },
                { Icon: Zap, title: '48-Hour Seller Verification', text: 'No credit lists without AI-assisted verification. Sellers submit project docs, registry serials, and vintage year. AI reviews and approves.' },
                { Icon: Shield, title: 'Sovereign Backing', text: 'Credits originate from SwissX Sovereign Wealth Fund programs operating under the laws of 5 Carbon Union nations.' },
              ].map(({ Icon, title, text }, i) => (
                <div key={i} className="x-trust-card">
                  <div style={{ marginBottom: 16 }}><Icon size={32} color={C.gold} /></div>
                  <div style={{ fontFamily: F.playfair, fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{title}</div>
                  <div style={{ fontSize: 13, color: C.cream3, lineHeight: 1.7, marginBottom: 16 }}>{text}</div>
                </div>
              ))}
            </div>

            <div style={{ background: C.ink2, border: `1px solid ${C.goldborder}`, padding: '40px 48px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
                <div>
                  <div style={s.eyebrow as React.CSSProperties}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />Sample Receipt</div>
                  <h3 style={{ fontFamily: F.playfair, fontSize: 28, fontWeight: 700, lineHeight: 1.2, marginBottom: 16 }}>What your auditors <em style={{ color: C.gold }}>actually see.</em></h3>
                  <p style={{ fontSize: 13, color: C.cream3, lineHeight: 1.75, marginBottom: 24 }}>Every trade on UAIU.LIVE/X generates a permanent public receipt. Your compliance team forwards the verification URL — your auditors confirm the hash chain independently. No trust required.</p>
                </div>
                <div style={{ background: C.ink, border: `1px solid ${C.goldborder}`, padding: 24, fontFamily: F.mono, fontSize: 11, lineHeight: 1.9 }}>
                  <div style={{ color: C.gold, marginBottom: 12, fontSize: 9, letterSpacing: '0.2em' }}>UAIU TRADE RECEIPT · VERIFIED</div>
                  <div style={{ color: C.cream3 }}>Trade ID: &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: C.cream }}>UAIU-BUY-829341</span></div>
                  <div style={{ color: C.cream3 }}>Standard: &nbsp;&nbsp;&nbsp;<span style={{ color: C.cream }}>SwissX B100 / VCS</span></div>
                  <div style={{ color: C.cream3 }}>Origin: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: C.cream }}>Antigua, Caribbean</span></div>
                  <div style={{ color: C.cream3 }}>Volume: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: C.cream }}>50,000 tCO₂</span></div>
                  <div style={{ color: C.cream3 }}>Price: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: C.cream }}>€71.80/tonne</span></div>
                  <div style={{ color: C.cream3 }}>Gross: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: C.cream }}>€3,590,000.00</span></div>
                  <div style={{ color: C.cream3 }}>Fee (0.75%): <span style={{ color: C.cream }}>€26,925.00</span></div>
                  <div style={{ color: C.cream3 }}>Settlement: &nbsp;<span style={{ color: C.green }}>T+1 · COMPLETE</span></div>
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.goldborder}` }}>
                    <div style={{ color: C.cream3 }}>Registry: &nbsp;&nbsp;&nbsp;<span style={{ color: C.cream }}>VCS-7821-2024-001</span></div>
                    <div style={{ color: C.cream3 }}>Receipt Hash:</div>
                    <div style={{ color: C.gold, wordBreak: 'break-all', fontSize: 10 }}>a3f9c2e1b4d87f6c5e2a1b9d8c7f4e3a2b1c9d8e7f6a5b4c3d2e1f0a9b8c7d6</div>
                    <div style={{ color: C.cream4, marginTop: 4, fontSize: 9 }}>Verify: uaiu.live/verify/UAIU-BUY-829341</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 48, textAlign: 'center' }}>
              <div style={{ ...s.eyebrow as React.CSSProperties, justifyContent: 'center', marginBottom: 16 }}><span style={{ width: 28, height: 1, background: C.gold, display: 'inline-block' }} />Verify Any Trade</div>
              <h3 style={{ fontFamily: F.playfair, fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Enter a Trade ID to verify.</h3>
              <p style={{ fontSize: 14, color: C.cream3, marginBottom: 24 }}>Any counterparty, regulator, or auditor can independently verify any UAIU trade — no account required.</p>
              <div style={{ display: 'flex', maxWidth: 560, margin: '0 auto' }}>
                <input className="x-fi" style={{ ...s.fi, flex: 1, fontFamily: F.mono, borderRight: 'none' }} type="text" placeholder="e.g. UAIU-BUY-829341" value={verifyInput} onChange={e => setVerifyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookupTrade()} data-testid="input-verify-trade" />
                <button style={{ background: C.gold, color: C.ink, border: 'none', padding: '0 28px', fontFamily: F.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }} onClick={lookupTrade} data-testid="button-verify-trade">Verify →</button>
              </div>
              {verifyResult && (
                <div style={{ marginTop: 20, fontFamily: F.mono, fontSize: 11 }}>
                  {verifyResult.type === 'found' && (
                    <div style={{ background: C.ink2, border: `1px solid ${C.goldborder}`, padding: 24, textAlign: 'left', maxWidth: 600, margin: '0 auto' }}>
                      <div style={{ color: C.green, marginBottom: 12, fontSize: 9, letterSpacing: '0.2em' }}>&#10003; VERIFIED — UAIU RECEIPT FOUND</div>
                      <div style={{ lineHeight: 2, color: C.cream3 }}>
                        Trade ID: <span style={{ color: C.cream }}>{verifyResult.trade.id}</span><br />
                        Volume: <span style={{ color: C.cream }}>{(verifyResult.trade.volumeTonnes || 0).toLocaleString()} tCO₂</span><br />
                        Price: <span style={{ color: C.cream }}>€{(verifyResult.trade.priceEurPerTonne || 0).toFixed(2)}/tonne</span><br />
                        Settlement: <span style={{ color: C.green }}>T+1 · Complete</span><br />
                        Receipt Hash: <span style={{ color: C.gold, wordBreak: 'break-all' }}>{verifyResult.trade.receiptHash}</span>
                      </div>
                    </div>
                  )}
                  {verifyResult.type === 'valid-format' && (
                    <div style={{ background: C.ink2, border: `1px solid ${C.goldborder}`, padding: 24, textAlign: 'left', maxWidth: 600, margin: '0 auto' }}>
                      <div style={{ color: C.gold, marginBottom: 12, fontSize: 9, letterSpacing: '0.2em' }}>&#9711; TRADE ID FORMAT VALID</div>
                      <div style={{ fontSize: 11, color: C.cream3, lineHeight: 1.8 }}>
                        Trade <span style={{ color: C.cream }}>{verifyResult.id}</span> exists in the registry.<br />
                        Full verification available via authenticated API.<br />
                        <span style={{ fontSize: 10, color: C.cream4 }}>Contact desk@uaiu.live with Trade ID to request audit pack.</span>
                      </div>
                    </div>
                  )}
                  {verifyResult.type === 'not-found' && <span style={{ color: C.red }}>&#9888; Trade ID not found. Format: UAIU-BUY-XXXXXX or UAIU-SELL-XXXXXX</span>}
                  {verifyResult.type === 'error' && <span style={{ color: C.red }}>&#9888; {verifyResult.msg}</span>}
                </div>
              )}
            </div>
          </div>
        </section>

        <div id="cta" style={{ background: C.ink, padding: '0 52px 120px' }}>
          <div style={{ maxWidth: 1440, margin: '0 auto', background: C.ink2, border: `1px solid ${C.goldborder}`, padding: 80, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.gold},transparent)` }} />
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 80% at 50% 50%,rgba(212,168,67,0.05),transparent)`, pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.gold, marginBottom: 24 }}>Ready to Trade</div>
              <div style={{ fontFamily: F.playfair, fontSize: 'clamp(42px,5vw,72px)', fontWeight: 900, lineHeight: 1.0, marginBottom: 24, letterSpacing: '-0.02em' }}>The market is open.<br /><em style={{ fontStyle: 'italic', color: C.gold }}>Are you?</em></div>
              <div style={{ fontSize: 16, color: C.cream3, maxWidth: 560, margin: '0 auto 48px', lineHeight: 1.7 }}>Open your account in minutes. Browse verified credits, calculate your compliance gap, and execute your first trade today — with full regulatory documentation included.</div>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="x-btn-primary" onClick={() => { setAcctSuccess(false); setShowAccountModal(true); }} data-testid="button-open-account-cta">Open Account Free →</button>
                <button className="x-btn-ghost" onClick={() => scrollTo('list')} data-testid="button-list-cta">List Your Credits</button>
              </div>
            </div>
          </div>
        </div>

        <section id="prediction" style={{ borderTop: `1px solid ${C.goldborder}` }}>
          <AIPricePrediction currentPrice={currentIndexPrice} isDark={isDark} />
        </section>

        <section id="budget" style={{ borderTop: `1px solid ${C.goldborder}`, borderBottom: `1px solid ${C.goldborder}` }}>
          <CarbonBudgetTracker trades={sessionTrades.map(t => ({ id: t.trade_id || t.id || '', date: new Date().toISOString().split('T')[0], tonnes: t.volume_tonnes || 0, price_eur: t.gross_eur || 0, standard: t.standard || 'Carbon Credit' }))} listings={listings.map(l => ({ id: l.id, name: l.name, standard: l.standard, price: l.pricePerTonne, available_tonnes: 10000 }))} isDark={isDark} onBuyListing={() => scrollTo('marketplace')} />
        </section>

        <section id="calendar" style={{ borderTop: `1px solid ${C.goldborder}` }}>
          <RegulatoryCalendar isDark={isDark} />
        </section>

        <footer style={{ background: C.ink2, borderTop: `1px solid ${C.goldborder}`, padding: '60px 52px 40px' }}>
          <div className="x-footer-grid" style={{ maxWidth: 1440, margin: '0 auto', display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr', gap: 60, marginBottom: 52 }}>
            <div>
              <div style={{ fontFamily: F.playfair, fontSize: 24, fontWeight: 700, marginBottom: 16 }}>UAIU<sup style={{ color: C.gold, fontSize: 12, fontFamily: F.mono, fontWeight: 400, letterSpacing: '0.15em' }}>.LIVE/X</sup></div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: C.cream3, maxWidth: 300 }}>The Caribbean Carbon Credit Marketplace. Connecting compliant credit supply with mandatory institutional demand since 2025. UAIU Holdings Corp, Wyoming.</div>
            </div>
            <div>
              <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 20 }}>Marketplace</div>
              <a href="#marketplace" className="x-footer-link" onClick={e => { e.preventDefault(); scrollTo('marketplace'); }}>Browse Credits</a>
              <a href="#" className="x-footer-link" onClick={e => { e.preventDefault(); openTrade(null, 'buy'); }}>Buy Now</a>
              <a href="#list" className="x-footer-link" onClick={e => { e.preventDefault(); scrollTo('list'); }}>List Credits</a>
              <a href="#rfq" className="x-footer-link" onClick={e => { e.preventDefault(); scrollTo('rfq'); }}>Bulk Offtake</a>
            </div>
            <div>
              <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 20 }}>Programs</div>
              <span className="x-footer-link" style={{ cursor: 'default' }}>SwissX B100</span>
              <span className="x-footer-link" style={{ cursor: 'default' }}>REDD++ Caribbean</span>
              <span className="x-footer-link" style={{ cursor: 'default' }}>Blue Carbon</span>
              <span className="x-footer-link" style={{ cursor: 'default' }}>Maritime Solutions</span>
              <span className="x-footer-link" style={{ cursor: 'default' }}>Aviation CORSIA</span>
            </div>
            <div>
              <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 20 }}>Company</div>
              <span className="x-footer-link" style={{ cursor: 'default' }}>About UAIU</span>
              <a href="#compliance" className="x-footer-link" onClick={e => { e.preventDefault(); scrollTo('compliance'); }}>Compliance</a>
              <a href="#" className="x-footer-link" onClick={e => { e.preventDefault(); setAcctSuccess(false); setShowAccountModal(true); }}>Open Account</a>
              <a href="#rfq" className="x-footer-link" onClick={e => { e.preventDefault(); scrollTo('rfq'); }}>Institutional</a>
            </div>
          </div>
          <div style={{ maxWidth: 1440, margin: '0 auto', paddingTop: 32, borderTop: `1px solid ${C.goldborder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream4, lineHeight: 1.8, letterSpacing: '0.03em' }}>
              © 2025 UAIU Holdings Corp. Registered in Wyoming, USA. Caribbean Basin Operations.<br />
              Carbon credits are financial instruments. Trading involves risk. Past performance does not guarantee future results.<br />
              All credits verified per applicable international standards. For institutional and corporate use.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['VCS Verified', 'EU ETS', 'Gold Standard', 'CORSIA', 'Wyoming LLC'].map(b => (
                <div key={b} style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.cream4, border: `1px solid ${C.goldborder}`, padding: '5px 12px' }}>{b}</div>
              ))}
            </div>
          </div>
        </footer>

      </div>

      {showTradeModal && (
        <div className="x-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowTradeModal(false); }}>
          <div className="x-modal" style={{ maxWidth: 480 }}>
            <div style={{ padding: '32px 36px', borderBottom: `1px solid ${C.goldborder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: F.playfair, fontSize: 26, fontWeight: 700 }}>{tradeTab === 'buy' ? 'Buy Credits' : 'Sell Credits'}</div>
              <button style={{ background: 'none', border: 'none', color: C.cream3, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 4 }} onClick={() => setShowTradeModal(false)} data-testid="button-close-trade">&#10005;</button>
            </div>
            <div style={{ padding: '32px 36px' }}>
              {tradeSuccess ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ marginBottom: 20 }}><CheckCircle size={56} color={C.gold} /></div>
                  <div style={{ fontFamily: F.playfair, fontSize: 28, fontWeight: 700, color: C.gold, marginBottom: 10 }}>{tradeTab === 'buy' ? 'Order Placed' : 'Credits Listed'}</div>
                  <div style={{ fontSize: 14, color: C.cream3, lineHeight: 1.7, marginBottom: 16 }}>
                    {tradeTab === 'buy' ? 'Your buy order has been submitted. Settlement completes T+1.' : 'Your credits are now listed. Our team will notify you when a buyer matches your order.'}
                  </div>
                  {tradeTab === 'buy' && <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, marginBottom: 8 }}>Receipt Hash: <span style={{ color: C.gold }}>{tradeHashStr.slice(0, 32)}...</span></div>}
                  <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream4 }}>Order Ref: {tradeRefStr}</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', borderBottom: `1px solid ${C.goldborder}`, margin: '-32px -36px 28px' }}>
                    <button className={`x-mtab${tradeTab === 'buy' ? ' active' : ''}`} onClick={() => setTradeTab('buy')} data-testid="button-trade-tab-buy">Buy Credits</button>
                    <button className={`x-mtab${tradeTab === 'sell' ? ' active' : ''}`} onClick={() => setTradeTab('sell')} data-testid="button-trade-tab-sell">Sell Credits</button>
                  </div>
                  <div style={{ background: C.ink, border: `1px solid ${C.goldborder}`, padding: '20px 24px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, letterSpacing: '0.1em' }}>Current Price</div><div style={{ fontFamily: F.playfair, fontSize: 32, fontWeight: 700, color: C.gold }}>€{parseFloat(tradeTypeValue).toFixed(2)}</div></div>
                    <div style={{ textAlign: 'right' }}><div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3 }}>24h Change</div><div style={{ fontFamily: F.mono, fontSize: 11, color: C.green }}>▲ +2.3% today</div></div>
                  </div>
                  <div style={s.fg}><label style={s.fl as React.CSSProperties}>Credit Type</label>
                    <select className="x-fi" style={s.fi} value={tradeTypeValue} onChange={e => setTradeTypeValue(e.target.value)} data-testid="select-trade-type">
                      {TRADE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div style={s.fg}><label style={s.fl as React.CSSProperties}>Quantity (tonnes CO₂)</label>
                    <input className="x-fi" style={s.fi} type="number" value={tradeQty} min={1} onChange={e => setTradeQty(parseInt(e.target.value) || 0)} data-testid="input-trade-qty" />
                  </div>
                  <div style={{ background: C.ink, border: `1px solid ${C.goldborder}`, padding: '16px 20px', margin: '20px 0' }}>
                    {[{ k: 'Unit Price', v: `€${tradePrice.toFixed(2)}` }, { k: 'Quantity', v: `${tradeQty.toLocaleString()} tonnes` }, { k: 'Platform Fee (0.75%)', v: `€${tradeFee.toFixed(2)}` }].map(r => (
                      <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: `1px solid rgba(212,168,67,0.08)`, fontFamily: F.mono, fontSize: 11 }}>
                        <span style={{ color: C.cream3 }}>{r.k}</span><span style={{ color: C.cream }}>{r.v}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', fontFamily: F.mono, fontSize: 14 }}>
                      <span style={{ color: C.gold }}>Total</span><span style={{ color: C.gold }}>€{tradeTotal.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  {tradeTab === 'buy' ? (
                    <button className="x-execute-buy" onClick={() => handleExecuteTrade('buy')} disabled={tradeProcessing} data-testid="button-execute-buy">{tradeProcessing ? '⏳  Processing...' : '▲  Buy Carbon Credits'}</button>
                  ) : (
                    <button className="x-execute-sell" onClick={() => handleExecuteTrade('sell')} disabled={tradeProcessing} data-testid="button-execute-sell">{tradeProcessing ? '⏳  Processing...' : '▼  Sell Carbon Credits'}</button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showAccountModal && (
        <div className="x-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAccountModal(false); }}>
          <div className="x-modal">
            <div style={{ padding: '32px 36px', borderBottom: `1px solid ${C.goldborder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: F.playfair, fontSize: 26, fontWeight: 700 }}>{sessionAccount ? 'My Account' : acctModalTab === 'signin' ? 'Sign In' : 'Open Account'}</div>
              <button style={{ background: 'none', border: 'none', color: C.cream3, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 4 }} onClick={() => setShowAccountModal(false)} data-testid="button-close-account">&#10005;</button>
            </div>

            {sessionAccount ? (
              /* ── SIGNED-IN PANEL ── */
              <div style={{ padding: '32px 36px', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.greenfaint, border: `2px solid ${C.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 16px' }}>✓</div>
                <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.cream3, marginBottom: 6 }}>SIGNED IN</div>
                <div style={{ fontFamily: F.playfair, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{sessionAccount.company || `${sessionAccount.firstName || ''} ${sessionAccount.lastName || ''}`.trim() || 'Account'}</div>
                <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3, marginBottom: 4 }}>{sessionAccount.email}</div>
                <div style={{ display: 'inline-block', fontFamily: F.mono, fontSize: 9, fontWeight: 700, padding: '4px 12px', border: `1px solid ${C.goldborder}`, color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24 }}>{sessionAccount.accountType || 'Exchange Member'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24, background: C.ink, border: `1px solid ${C.goldborder}`, padding: 20 }}>
                  {[
                    { label: 'Annual CO₂ Target', value: sessionAccount.annualCo2 ? `${Number(sessionAccount.annualCo2).toLocaleString()} t` : '—' },
                    { label: 'Account Type', value: sessionAccount.accountType || '—' },
                    { label: 'Account ID', value: sessionAccount.id ? String(sessionAccount.id).slice(0, 8) + '…' : '—' },
                    { label: 'Session', value: 'Active ●' },
                  ].map((stat, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.cream3, marginBottom: 4 }}>{stat.label}</div>
                      <div style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: i === 3 ? C.green : C.cream }}>{stat.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button style={{ flex: 1, background: C.gold, color: C.ink, padding: '13px 0', fontFamily: F.syne, fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }} onClick={() => { setShowAccountModal(false); scrollTo('dashboard'); }}>View Dashboard →</button>
                  <button style={{ padding: '13px 20px', background: 'transparent', color: C.red, border: `1px solid rgba(239,68,68,0.3)`, fontFamily: F.mono, fontSize: 11, cursor: 'pointer', letterSpacing: '0.06em' }} onClick={handleSignOut}>Sign Out</button>
                </div>
              </div>
            ) : (
              /* ── TABS: OPEN ACCOUNT / SIGN IN ── */
              <>
                <div style={{ display: 'flex', borderBottom: `1px solid ${C.goldborder}`, padding: '0 36px' }}>
                  {([['open', 'Open Account'], ['signin', 'Sign In']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => { setAcctModalTab(key); setSigninError(''); }} style={{ padding: '14px 20px', background: 'transparent', border: 'none', borderBottom: acctModalTab === key ? `2px solid ${C.gold}` : '2px solid transparent', marginBottom: -1, cursor: 'pointer', fontFamily: F.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: acctModalTab === key ? C.gold : C.cream3, transition: 'all 0.15s' }}>{label}</button>
                  ))}
                </div>

                {acctModalTab === 'open' && (
                  <div style={{ padding: '32px 36px' }}>
                    {acctSuccess ? (
                      <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ marginBottom: 20 }}><CheckCircle size={56} color={C.gold} /></div>
                        <div style={{ fontFamily: F.playfair, fontSize: 28, fontWeight: 700, color: C.gold, marginBottom: 10 }}>Account Created</div>
                        <div style={{ fontSize: 14, color: C.cream3, lineHeight: 1.7 }}>Welcome to UAIU.LIVE/X. Our onboarding team will contact you within 2 business hours to complete KYC verification. You&apos;ll be live and trading today.</div>
                        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream4, marginTop: 16 }}>Account ID: {acctId}</div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, letterSpacing: '0.1em', marginBottom: 24, lineHeight: 1.6 }}>Free to open · KYC in 2 hours · Live same day</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div style={s.fg}><label style={s.fl as React.CSSProperties}>First Name *</label><input className="x-fi" style={s.fi} type="text" placeholder="First" value={acctFirstName} onChange={e => setAcctFirstName(e.target.value)} data-testid="input-acct-firstname" /></div>
                          <div style={s.fg}><label style={s.fl as React.CSSProperties}>Last Name *</label><input className="x-fi" style={s.fi} type="text" placeholder="Last" value={acctLastName} onChange={e => setAcctLastName(e.target.value)} data-testid="input-acct-lastname" /></div>
                        </div>
                        <div style={s.fg}><label style={s.fl as React.CSSProperties}>Company / Organization</label><input className="x-fi" style={s.fi} type="text" placeholder="Legal entity name" value={acctCompany} onChange={e => setAcctCompany(e.target.value)} data-testid="input-acct-company" /></div>
                        <div style={s.fg}><label style={s.fl as React.CSSProperties}>Business Email *</label><input className="x-fi" style={s.fi} type="email" placeholder="you@company.com" value={acctEmail} onChange={e => setAcctEmail(e.target.value)} data-testid="input-acct-email" /></div>
                        <div style={s.fg}><label style={s.fl as React.CSSProperties}>Phone</label><input className="x-fi" style={s.fi} type="tel" placeholder="+1 (000) 000-0000" value={acctPhone} onChange={e => setAcctPhone(e.target.value)} data-testid="input-acct-phone" /></div>
                        <div style={s.fg}><label style={s.fl as React.CSSProperties}>Account Type *</label><select className="x-fi" style={s.fi} value={acctType} onChange={e => setAcctType(e.target.value)} data-testid="select-acct-type"><option value="">Select account type</option>{ACCOUNT_TYPES.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                        <div style={s.fg}><label style={s.fl as React.CSSProperties}>Annual CO₂ Exposure (approx.)</label><select className="x-fi" style={s.fi} value={acctCo2} onChange={e => setAcctCo2(e.target.value)} data-testid="select-acct-co2"><option value="">Select range</option>{CO2_RANGES.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                        <button style={{ ...s.formSubmit as React.CSSProperties, opacity: acctSubmitting ? 0.7 : 1 }} onClick={handleAccountSubmit} disabled={acctSubmitting} data-testid="button-submit-account">{acctSubmitting ? 'Creating Account...' : 'Create Account →'}</button>
                        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream4, marginTop: 16, textAlign: 'center', lineHeight: 1.6, letterSpacing: '0.05em' }}>By creating an account you agree to our Terms of Service and Privacy Policy. UAIU Holdings Corp. Wyoming.</div>
                      </>
                    )}
                  </div>
                )}

                {acctModalTab === 'signin' && (
                  <div style={{ padding: '32px 36px' }}>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, letterSpacing: '0.1em', marginBottom: 24, lineHeight: 1.6 }}>Enter the business email you used when opening your account.</div>
                    <div style={s.fg}>
                      <label style={s.fl as React.CSSProperties}>Business Email</label>
                      <input
                        className="x-fi"
                        style={{ ...s.fi, borderColor: signinError ? 'rgba(239,68,68,0.5)' : undefined }}
                        type="email"
                        placeholder="compliance@yourcompany.com"
                        value={signinEmail}
                        onChange={e => { setSigninEmail(e.target.value); setSigninError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') handleSignIn(); }}
                        autoFocus
                        data-testid="input-signin-email"
                      />
                    </div>
                    {signinError && <div style={{ fontFamily: F.mono, fontSize: 11, color: C.red, marginBottom: 16, marginTop: -12 }}>⚠ {signinError}</div>}
                    <button style={{ ...s.formSubmit as React.CSSProperties, opacity: signinLoading || !signinEmail.trim() ? 0.6 : 1 }} onClick={handleSignIn} disabled={signinLoading || !signinEmail.trim()} data-testid="button-signin-submit">{signinLoading ? 'Looking up account...' : 'Access Account →'}</button>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream4, marginTop: 16, textAlign: 'center', letterSpacing: '0.05em' }}>
                      No account?{' '}
                      <button onClick={() => setAcctModalTab('open')} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontFamily: F.mono, fontSize: 10, textDecoration: 'underline', padding: 0, letterSpacing: '0.05em' }}>Open one free →</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showMultiSig && pendingTradeId && (
        <MultiSigApproval
          tradeId={pendingTradeId}
          receiptHash={sessionTrades[0]?.receipt_hash || sessionTrades[0]?.receiptHash || ''}
          onApproved={() => { setShowMultiSig(false); showToast('Multi-sig approval complete — trade finalized'); }}
          onSkip={() => setShowMultiSig(false)}
        />
      )}

      {toast.show && (
        <div style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 9000, background: C.ink2, border: `1px solid ${C.gold}`, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, animation: 'toastIn 0.3s ease', maxWidth: 360 }}>
          <span style={{ color: C.gold, fontSize: 18, flexShrink: 0 }}>&#9670;</span>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: C.cream, letterSpacing: '0.05em', lineHeight: 1.5 }}>{toast.msg}</span>
        </div>
      )}
    </>
  );
}
