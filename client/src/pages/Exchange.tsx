import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, TrendingDown, Search, Star, ChevronRight, Globe,
  Shield, Clock, FileText, ArrowRight, Leaf, Waves, Trees, Wind, Home,
  ExternalLink, CheckCircle2
} from "lucide-react";

interface ExchangeListing {
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

const FILTER_TABS = ['ALL', 'EU ETS', 'VCS', 'GOLD STD', 'CORSIA'];

const STANDARD_COLORS: Record<string, string> = {
  'EU ETS': 'bg-blue-900/60 text-blue-200 border-blue-700',
  'VCS': 'bg-emerald-900/60 text-emerald-200 border-emerald-700',
  'GOLD STD': 'bg-amber-900/60 text-amber-200 border-amber-700',
  'CORSIA': 'bg-purple-900/60 text-purple-200 border-purple-700',
};

const ROLE_OPTIONS = [
  'Corporate Buyer',
  'Credit Generator / Project Developer',
  'Broker / Trader',
  'Maritime / Shipping Operator',
  'Aviation Operator',
  'Investment / Fund',
  'Other',
];

const STANDARD_OPTIONS = [
  'EU ETS — European Union Allowances',
  'VCS — Verified Carbon Standard',
  'Gold Standard',
  'CORSIA — Aviation Offsets',
  'Blue Carbon / VCS',
  'Other',
];

const CREDIT_TYPE_OPTIONS = [
  'Biofuel Production (B100 / SAF)',
  'REDD++ Forest Conservation',
  'Blue Carbon / Seagrass',
  'Coral Restoration',
  'Agricultural Waste → Biogas',
  'Renewable Energy (Solar / Wind)',
  'Human Waste Biodigester',
  'Other',
];

const NATIONS = [
  { name: 'Antigua & Barbuda', label: 'REGISTRY HQ', color: 'from-emerald-800 to-emerald-950', icon: Globe },
  { name: 'Tonga', label: 'PACIFIC BLUE CARBON', color: 'from-blue-800 to-blue-950', icon: Waves },
  { name: 'Zambia', label: 'REDD++ FORESTRY', color: 'from-green-800 to-green-950', icon: Trees },
  { name: 'Kenya', label: 'REGENERATIVE AGRICULTURE', color: 'from-yellow-800 to-yellow-950', icon: Leaf },
  { name: 'St. Kitts & Nevis', label: 'CARIBBEAN BIOFUEL', color: 'from-cyan-800 to-cyan-950', icon: Wind },
];

const TESTIMONIALS = [
  {
    quote: "We needed EU ETS-compliant credits for our Caribbean routing fleet. UAIU.LIVE/X had verified inventory, competitive pricing, and our compliance team had the documentation they needed in under 24 hours.",
    author: "Head of Sustainability",
    company: "Major Caribbean Cruise Operator",
  },
  {
    quote: "Listing our REDD++ forest conservation credits on UAIU took 48 hours. Within a week we had three institutional buyers. The Caribbean origin premium is real — we're selling at 11% above what we'd get on other platforms.",
    author: "Director of Carbon Programs",
    company: "Caribbean Conservation Trust",
  },
  {
    quote: "The compliance calculator alone was worth the call. We didn't realize how much EU ETS exposure our Caribbean routes were generating. UAIU showed us the number and had a solution ready in the same conversation.",
    author: "CFO",
    company: "Regional Maritime Logistics Group",
  },
];

export default function Exchange() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [co2Tonnes, setCo2Tonnes] = useState(25000);
  const [accountForm, setAccountForm] = useState({ orgName: '', contactName: '', email: '', role: '' });
  const [listForm, setListForm] = useState({
    orgName: '', contactName: '', email: '',
    standard: '', creditType: '', volumeTonnes: '',
    askingPricePerTonne: '', projectOrigin: '', registrySerial: '',
  });
  const tickerRef = useRef<HTMLDivElement>(null);

  const { data: listings = [] } = useQuery<ExchangeListing[]>({
    queryKey: ['/api/exchange/listings'],
  });

  const filteredListings = listings.filter(l => {
    const matchFilter = activeFilter === 'ALL' || l.standard === activeFilter;
    const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.origin.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const accountMutation = useMutation({
    mutationFn: (data: typeof accountForm) => apiRequest('POST', '/api/exchange/account', data),
    onSuccess: () => {
      toast({ title: "Account request submitted!", description: "We'll be in touch within 2 business hours." });
      setShowAccountModal(false);
      setAccountForm({ orgName: '', contactName: '', email: '', role: '' });
    },
    onError: () => toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" }),
  });

  const listMutation = useMutation({
    mutationFn: (data: typeof listForm) => apiRequest('POST', '/api/exchange/list-credits', data),
    onSuccess: () => {
      toast({ title: "Credits submitted for verification!", description: "Our team will review within 48 hours." });
      setShowListModal(false);
      setListForm({ orgName: '', contactName: '', email: '', standard: '', creditType: '', volumeTonnes: '', askingPricePerTonne: '', projectOrigin: '', registrySerial: '' });
    },
    onError: () => toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" }),
  });

  const euEtsPrice = listings.find(l => l.standard === 'EU ETS')?.pricePerTonne ?? 63.40;
  const euEtsFine = co2Tonnes * 100;
  const uaiuCost = Math.round(co2Tonnes * euEtsPrice * 0.70);
  const savings = euEtsFine - uaiuCost;

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
        {/* Ticker tape */}
        <div className="bg-emerald-950 border-b border-emerald-900 overflow-hidden">
          <div className="flex items-center gap-8 py-1.5 px-4 animate-none">
            <div className="flex items-center gap-8 text-xs whitespace-nowrap overflow-x-auto scrollbar-none" style={{ scrollbarWidth: 'none' }}>
              <span className="text-emerald-400 font-semibold shrink-0">MARKETS OPEN</span>
              {listings.map(l => (
                <span key={l.id} className="flex items-center gap-1.5 shrink-0">
                  <span className="text-slate-300">{l.name.split(' ').slice(0, 2).join(' ')}</span>
                  <span className="text-white font-semibold">€{l.pricePerTonne.toFixed(2)}</span>
                  <span className={l.changeDirection === 'up' ? 'text-emerald-400' : 'text-red-400'}>
                    {l.changeDirection === 'up' ? '▲' : '▼'} {l.changePercent.toFixed(1)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Main nav */}
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition-colors" data-testid="button-home">
              <Home className="h-4 w-4" />
            </button>
            <div className="h-4 w-px bg-slate-700" />
            <span className="text-white font-bold tracking-wider text-lg">UAIU<span className="text-emerald-400">.</span>LIVE<span className="text-slate-400">/X</span></span>
            <Badge className="text-xs bg-emerald-500/20 text-emerald-300 border-emerald-700 no-default-active-elevate">EXCHANGE</Badge>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <a href="#listings" className="hover:text-white transition-colors">Listings</a>
            <a href="#process" className="hover:text-white transition-colors">How It Works</a>
            <a href="#sellers" className="hover:text-white transition-colors">Sellers</a>
            <a href="#citizens" className="hover:text-white transition-colors">Citizens Portal</a>
          </nav>
          <Button
            onClick={() => setShowAccountModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
            data-testid="button-open-account-header"
          >
            Open Account
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <Badge className="mb-6 bg-emerald-500/20 text-emerald-300 border-emerald-700 text-xs tracking-widest no-default-active-elevate">
          THE CARIBBEAN CARBON CREDIT MARKETPLACE
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
          The market is open.<br />
          <span className="text-emerald-400">Are you?</span>
        </h1>
        <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">
          Connecting compliant credit supply with mandatory institutional demand.
          EU ETS · VCS · Gold Standard · CORSIA — all verified, all live.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => setShowAccountModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-8"
            data-testid="button-open-account-hero"
          >
            Open Account — Free <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' })}
            className="border-slate-600 text-slate-200"
            data-testid="button-view-listings"
          >
            View Listings
          </Button>
        </div>
      </section>

      {/* Listings */}
      <section id="listings" className="container mx-auto px-4 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">Available Credits</h2>
            <p className="text-slate-400 text-sm mt-1">All credits pre-verified for compliance</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search credits..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 w-64"
              data-testid="input-search-credits"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap mb-8" data-testid="filter-tabs">
          {FILTER_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeFilter === tab
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              data-testid={`filter-${tab.replace(' ', '-').toLowerCase()}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Listing cards */}
        <div className="space-y-4">
          {filteredListings.map(listing => (
            <div
              key={listing.id}
              className="bg-slate-900 border border-slate-800 rounded-md p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover-elevate"
              data-testid={`card-listing-${listing.id}`}
            >
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className={`px-2 py-1 rounded text-xs font-bold border shrink-0 ${STANDARD_COLORS[listing.standard] ?? 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                  {listing.badgeLabel}
                </div>
                <div className="min-w-0">
                  {listing.isAcceptingOrders && (
                    <p className="text-xs text-emerald-400 mb-1 font-medium">Accepting Orders available</p>
                  )}
                  <h3 className="font-bold text-white text-lg leading-tight">{listing.name}</h3>
                  <p className="text-slate-400 text-sm mt-0.5">{listing.origin}</p>
                </div>
              </div>

              <div className="flex flex-col md:items-end gap-1 shrink-0">
                <div className="text-2xl font-bold text-white">€{listing.pricePerTonne.toFixed(2)}</div>
                <div className={`flex items-center gap-1 text-sm font-medium ${listing.changeDirection === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {listing.changeDirection === 'up' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {listing.changeDirection === 'up' ? '+' : '-'}{listing.changePercent.toFixed(1)}% today
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-end gap-1 mr-2">
                  <span className="text-xs text-slate-400">EU Market</span>
                  <span className="text-xs text-emerald-400 font-medium">● Active</span>
                </div>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={() => setShowAccountModal(true)}
                  data-testid={`button-buy-${listing.id}`}
                >
                  Buy Now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600 text-slate-200"
                  onClick={() => setShowListModal(true)}
                  data-testid={`button-sell-${listing.id}`}
                >
                  Sell Similar
                </Button>
              </div>
            </div>
          ))}
          {filteredListings.length === 0 && (
            <div className="text-center py-12 text-slate-500">No listings found for this filter.</div>
          )}
        </div>
      </section>

      {/* Process + Calculator */}
      <section id="process" className="bg-slate-900 border-y border-slate-800 py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            {/* Left: process steps */}
            <div>
              <h2 className="text-3xl font-bold mb-3">Buying credits.<br /><span className="text-emerald-400">Simplified.</span></h2>
              <p className="text-slate-400 mb-10">From registration to settlement in under 24 hours. The fastest compliant carbon credit transaction in the Caribbean basin.</p>
              <div className="space-y-8">
                {[
                  { num: '01', title: 'Open Your Account', detail: 'Register as a corporate buyer, credit generator, or broker. KYC verification typically completes within 2 business hours. All account types accepted globally.', tag: 'FREE · 2HRS' },
                  { num: '02', title: 'Select Your Credits', detail: 'Browse verified listings filtered by standard (EU ETS, VCS, Gold Standard, CORSIA), origin, vintage year, and price. Every credit is pre-verified for compliance.', tag: 'REAL-TIME · LIVE PRICING' },
                  { num: '03', title: 'Execute & Settle', detail: 'Place your order. Instant price lock. Settlement within T+1. Credits transferred to your registry account with full blockchain provenance trail.', tag: 'T+1 SETTLEMENT · 0.75% FEE' },
                  { num: '04', title: 'Report & Retire', detail: 'Auto-generate your EU ETS compliance report. Retire credits directly from your dashboard. One-click export for regulatory submission to EU and national authorities.', tag: 'AUTOMATED · AUDIT-READY' },
                ].map(step => (
                  <div key={step.num} className="flex gap-5">
                    <div className="text-3xl font-bold text-slate-700 w-10 shrink-0">{step.num}</div>
                    <div>
                      <h3 className="font-bold text-white text-lg">{step.title}</h3>
                      <p className="text-slate-400 text-sm mt-1 mb-2">{step.detail}</p>
                      <Badge className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-800 no-default-active-elevate">{step.tag}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: calculator */}
            <div className="bg-slate-950 border border-slate-800 rounded-md p-8">
              <div className="mb-2">
                <span className="text-xs text-slate-500 tracking-widest">YOUR EU ETS EXPOSURE</span>
              </div>
              <h3 className="text-2xl font-bold mb-2">Compliance Cost<br />Calculator</h3>
              <p className="text-slate-400 text-sm mb-6">EU ETS Maritime & Aviation · 2025 Rates</p>

              <div className="mb-6">
                <Label htmlFor="co2-input" className="text-sm text-slate-300 mb-2 block">
                  Annual CO₂ emissions (tonnes):
                </Label>
                <Input
                  id="co2-input"
                  type="number"
                  min={1000}
                  max={10000000}
                  value={co2Tonnes}
                  onChange={e => setCo2Tonnes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="bg-slate-900 border-slate-700 text-white text-lg font-semibold"
                  data-testid="input-co2-tonnes"
                />
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center py-3 border-b border-slate-800">
                  <span className="text-slate-400 text-sm">EU ETS Fine (no credits)</span>
                  <span className="text-red-400 font-bold text-lg">€{euEtsFine.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-800">
                  <span className="text-slate-400 text-sm">Market Credit Cost (UAIU)</span>
                  <span className="text-white font-bold text-lg">€{uaiuCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-800">
                  <span className="text-slate-400 text-sm">Your Compliance Rate</span>
                  <span className="text-emerald-400 font-bold">70% covered (2025)</span>
                </div>
              </div>

              <div className="bg-emerald-950 border border-emerald-800 rounded-md p-5 mb-6">
                <p className="text-xs text-emerald-400 mb-1">ANNUAL SAVINGS VS FINE</p>
                <p className="text-3xl font-bold text-white">€{savings.toLocaleString()}</p>
                <p className="text-xs text-emerald-400 mt-1">Using UAIU.LIVE/X credits at €{euEtsPrice.toFixed(2)}/tonne</p>
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={() => setShowAccountModal(true)}
                data-testid="button-buy-credits-calculator"
              >
                Buy Credits Now <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Sellers */}
      <section id="sellers" className="py-20 container mx-auto px-4">
        <div className="max-w-3xl mb-12">
          <span className="text-xs text-slate-500 tracking-widest">SELLERS</span>
          <h2 className="text-3xl font-bold mt-2 mb-4">List your credits.<br /><span className="text-emerald-400">Reach the world.</span></h2>
          <p className="text-slate-400">Whether you're a biofuel producer, a land conservation program, or a carbon project developer — UAIU.LIVE/X connects you directly to institutional buyers who need your credits right now.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {[
            { title: 'List in 48 Hours', body: 'Submit your project documentation, receive verification, go live. Fastest onboarding in the carbon market — faster than Verra, faster than Gold Standard direct.', tag: 'Required: Project docs · Registry serial numbers · Vintage year', icon: Clock },
            { title: '0% Listing Fee', body: 'Free to list. We charge 0.75% on successful transactions only. No upfront costs, no subscription, no hidden fees. You keep 99.25% of every sale.', tag: 'Success-only commission · Wire or crypto settlement', icon: Shield },
            { title: 'Caribbean Premium Pricing', body: 'Caribbean-origin credits command a premium on UAIU.LIVE/X — buyers specifically seeking island-nation and indigenous land program credits pay above EU ETS spot.', tag: 'SwissX B100 credits average 13% above EU ETS spot', icon: TrendingUp },
            { title: 'Blockchain Provenance', body: "Every listed credit gets an immutable blockchain record linking it to its originating project. Eliminates double-counting risk and gives buyers full confidence.", tag: 'Integrated with major registries · Auto retirement tracking', icon: FileText },
          ].map(f => (
            <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-md p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-md bg-emerald-900/50 flex items-center justify-center shrink-0">
                  <f.icon className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-slate-400 text-sm mb-3">{f.body}</p>
                  <p className="text-xs text-emerald-400">{f.tag}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-md p-8 max-w-2xl mx-auto">
          <h3 className="text-xl font-bold mb-2">List Your Credits</h3>
          <p className="text-slate-400 text-sm mb-6">Free to list · 48hr verification · 0.75% success fee</p>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={() => setShowListModal(true)}
            data-testid="button-list-credits-main"
          >
            Submit for Verification <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Citizens Portal */}
      <section id="citizens" className="bg-slate-900 border-y border-slate-800 py-20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-16 items-start">
            <div className="md:w-1/2">
              <span className="text-xs text-slate-500 tracking-widest">KARMIC ECON</span>
              <h2 className="text-3xl font-bold mt-2 mb-4">The Citizens Portal.<br /><span className="text-emerald-400">Waste becomes wealth.</span></h2>
              <p className="text-slate-400 mb-8">For the first time, communities in sovereign Carbon Union nations can participate directly in the global carbon economy — earning verified credits from their own land, waste, and environmental programs.</p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8 flex-wrap">
                {NATIONS.map(n => (
                  <div key={n.name} className={`bg-gradient-to-br ${n.color} border border-slate-700 rounded-md p-4 flex flex-col gap-2`} data-testid={`card-nation-${n.name.split(' ')[0].toLowerCase()}`}>
                    <n.icon className="h-5 w-5 text-white/70" />
                    <div className="text-xs text-white/60 font-medium">{n.label}</div>
                    <div className="text-sm font-bold text-white">{n.name}</div>
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="text-xs text-emerald-300">Active</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4 text-sm text-slate-400">
                <div className="flex gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>Join a green project. Register via the Citizens Portal. Choose from local programs: biofuel production, coral restoration, reforestation, agricultural waste conversion, or regenerative soil building.</span>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>Earn verified credits. Every tonne of CO₂ averted or sequestered generates one verified carbon credit issued by the SwissX Carbon Registry in Antigua.</span>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>Credits are held in your SwissX wallet. Bank them, hold them as the price rises, or sell on UAIU.LIVE/X directly to institutional buyers.</span>
                </div>
              </div>
            </div>

            <div className="md:w-1/2">
              <div className="bg-slate-950 border border-slate-800 rounded-md p-6">
                <div className="text-xs text-slate-500 mb-1">Citizens Portal</div>
                <h3 className="font-bold text-white mb-1">SwissX Carbon Registry · Antigua</h3>
                <div className="text-xs text-slate-500 mb-5">OPEN PROGRAMS — ACCEPTING PARTICIPANTS</div>

                {[
                  { name: 'B100 Biofuel Production', loc: 'Antigua · SwissX Verified · 1 credit per 90 gal', color: 'emerald' },
                  { name: 'Coral Restoration — Pacific', loc: 'Tonga · Blue Carbon VCS · 28M+ acres', color: 'blue' },
                  { name: 'Agricultural Waste → Biogas', loc: 'Kenya · Gold Standard · per tonne CO₂ averted', color: 'amber' },
                  { name: 'REDD++ Forest Conservation', loc: 'Zambia · Gold Standard · annual sequestration', color: 'green' },
                ].map(prog => (
                  <div key={prog.name} className="flex items-center justify-between py-4 border-b border-slate-800 last:border-0 gap-4">
                    <div>
                      <div className="font-medium text-white text-sm">{prog.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{prog.loc}</div>
                    </div>
                    <Badge className={`text-xs shrink-0 no-default-active-elevate ${prog.color === 'emerald' ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700' : prog.color === 'blue' ? 'bg-blue-900/60 text-blue-300 border-blue-700' : prog.color === 'amber' ? 'bg-amber-900/60 text-amber-300 border-amber-700' : 'bg-green-900/60 text-green-300 border-green-700'}`}>
                      Enrolling
                    </Badge>
                  </div>
                ))}

                <div className="mt-6 bg-emerald-950 border border-emerald-900 rounded-md p-4">
                  <div className="text-xs text-emerald-400 mb-1">CURRENT CREDIT VALUE</div>
                  <div className="text-2xl font-bold text-white">€{(listings.find(l => l.standard === 'GOLD STD')?.pricePerTonne ?? 58.20).toFixed(2)}</div>
                  <div className="text-xs text-slate-400 mt-1">per verified credit · VCS / Gold Standard rate</div>
                </div>

                <Button
                  className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={() => setShowAccountModal(true)}
                  data-testid="button-join-citizens-portal"
                >
                  Join Citizens Portal <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Standards */}
      <section className="py-20 container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="text-xs text-slate-500 tracking-widest">STANDARDS & VERIFICATION</span>
          <h2 className="text-3xl font-bold mt-3 mb-4">Every credit.<br /><span className="text-emerald-400">Fully compliant.</span></h2>
          <p className="text-slate-400 max-w-xl mx-auto">UAIU.LIVE/X only lists credits verified by internationally recognized standards. No exceptions.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: 'EU ETS', sub: 'European Union Emissions Trading System' },
            { label: 'Verra VCS', sub: 'Verified Carbon Standard' },
            { label: 'Gold Standard', sub: 'Swiss Foundation Premium Certification' },
            { label: 'CORSIA', sub: 'ICAO Carbon Offset Scheme — Aviation' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-md p-5 text-center">
              <div className="text-emerald-400 font-bold text-lg mb-1">{s.label}</div>
              <div className="text-slate-400 text-xs mb-3">{s.sub}</div>
              <Badge className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-800 no-default-active-elevate">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Fully Supported
              </Badge>
            </div>
          ))}
        </div>

        <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-md p-8">
          <h3 className="text-xl font-bold mb-3">Built for the EU ETS mandate era</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            From 2025, EU shipping companies must surrender allowances for 70% of their emissions. By 2027, it's 100%. Every tonne of CO₂ not covered by a credit costs €100 in fines — nearly double the credit price. UAIU.LIVE/X exists to close that gap, cleanly, quickly, and with full regulatory documentation your compliance team can submit directly to national authorities.
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-slate-900 border-y border-slate-800 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-xs text-slate-500 tracking-widest">FROM OUR CLIENTS</span>
            <h2 className="text-3xl font-bold mt-3">Why institutions<br /><span className="text-emerald-400">choose UAIU.</span></h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-slate-950 border border-slate-800 rounded-md p-6" data-testid={`card-testimonial-${i}`}>
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-6 italic">"{t.quote}"</p>
                <div>
                  <div className="text-white font-semibold text-sm">{t.author}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{t.company}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 container mx-auto px-4 text-center">
        <span className="text-xs text-slate-500 tracking-widest">READY TO TRADE</span>
        <h2 className="text-4xl font-bold mt-4 mb-6">The market is open.<br /><span className="text-emerald-400">Are you?</span></h2>
        <p className="text-slate-400 mb-10 max-w-lg mx-auto">Open your account in minutes. Browse verified credits, calculate your compliance gap, and execute your first trade today — with full regulatory documentation included.</p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-10"
            onClick={() => setShowAccountModal(true)}
            data-testid="button-open-account-cta"
          >
            Open Account — Free
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-slate-600 text-slate-200"
            onClick={() => setShowListModal(true)}
            data-testid="button-list-credits-cta"
          >
            List Your Credits
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-10 bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="font-bold text-white mb-1">UAIU<span className="text-emerald-400">.</span>LIVE<span className="text-slate-400">/X</span></div>
              <p className="text-slate-500 text-xs mt-2">The Caribbean Carbon Credit Marketplace. Connecting compliant credit supply with mandatory institutional demand since 2025. UAIU Holdings Corp, Wyoming.</p>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold mb-3 tracking-wider">MARKETPLACE</div>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><button onClick={() => document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">Browse Credits</button></li>
                <li><button onClick={() => setShowAccountModal(true)} className="hover:text-white transition-colors">Buy Now</button></li>
                <li><button onClick={() => setShowListModal(true)} className="hover:text-white transition-colors">List Credits</button></li>
              </ul>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold mb-3 tracking-wider">PROGRAMS</div>
              <ul className="space-y-2 text-sm text-slate-400">
                {['SwissX B100', 'REDD++ Caribbean', 'Blue Carbon', 'Maritime Solutions', 'Aviation CORSIA'].map(p => (
                  <li key={p}><span className="text-slate-400">{p}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold mb-3 tracking-wider">COMPANY</div>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><button onClick={() => navigate('/')} className="hover:text-white transition-colors">UAIU Platform</button></li>
                <li><button onClick={() => setShowAccountModal(true)} className="hover:text-white transition-colors">Open Account</button></li>
                <li><a href="mailto:info@uaiu.live" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row justify-between gap-4 flex-wrap">
            <p className="text-xs text-slate-600">© 2025 UAIU Holdings Corp. Registered in Wyoming, USA. Caribbean Basin Operations. Carbon credits are financial instruments. Trading involves risk. All credits verified per applicable international standards. For institutional and corporate use.</p>
            <div className="flex gap-3 flex-wrap">
              {['VCS VERIFIED', 'EU ETS', 'GOLD STANDARD', 'CORSIA'].map(b => (
                <Badge key={b} className="text-xs bg-slate-800 text-slate-400 border-slate-700 no-default-active-elevate">{b}</Badge>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Open Account Modal */}
      <Dialog open={showAccountModal} onOpenChange={setShowAccountModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Open Your Account</DialogTitle>
            <p className="text-slate-400 text-sm">Free · KYC completes within 2 business hours</p>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-slate-300 text-sm">Organization Name</Label>
              <Input
                placeholder="Your company or program name"
                value={accountForm.orgName}
                onChange={e => setAccountForm(f => ({ ...f, orgName: e.target.value }))}
                className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                data-testid="input-account-org"
              />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Contact Name</Label>
              <Input
                placeholder="Full name"
                value={accountForm.contactName}
                onChange={e => setAccountForm(f => ({ ...f, contactName: e.target.value }))}
                className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                data-testid="input-account-contact"
              />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Email</Label>
              <Input
                type="email"
                placeholder="you@company.com"
                value={accountForm.email}
                onChange={e => setAccountForm(f => ({ ...f, email: e.target.value }))}
                className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                data-testid="input-account-email"
              />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Role / Account Type</Label>
              <Select value={accountForm.role} onValueChange={v => setAccountForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="mt-1 bg-slate-800 border-slate-700 text-white" data-testid="select-account-role">
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {ROLE_OPTIONS.map(r => (
                    <SelectItem key={r} value={r} className="text-white focus:bg-slate-700">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              disabled={accountMutation.isPending || !accountForm.orgName || !accountForm.contactName || !accountForm.email || !accountForm.role}
              onClick={() => accountMutation.mutate(accountForm)}
              data-testid="button-submit-account"
            >
              {accountMutation.isPending ? 'Submitting...' : 'Open Account — Free'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* List Credits Modal */}
      <Dialog open={showListModal} onOpenChange={setShowListModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">List Your Credits</DialogTitle>
            <p className="text-slate-400 text-sm">Free to list · 48hr verification · 0.75% success fee</p>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-sm">Organization Name</Label>
                <Input placeholder="Your company or program name" value={listForm.orgName} onChange={e => setListForm(f => ({ ...f, orgName: e.target.value }))} className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" data-testid="input-list-org" />
              </div>
              <div>
                <Label className="text-slate-300 text-sm">Contact Name</Label>
                <Input placeholder="Full name" value={listForm.contactName} onChange={e => setListForm(f => ({ ...f, contactName: e.target.value }))} className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" data-testid="input-list-contact" />
              </div>
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Email</Label>
              <Input type="email" placeholder="you@company.com" value={listForm.email} onChange={e => setListForm(f => ({ ...f, email: e.target.value }))} className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" data-testid="input-list-email" />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Credit Standard</Label>
              <Select value={listForm.standard} onValueChange={v => setListForm(f => ({ ...f, standard: v }))}>
                <SelectTrigger className="mt-1 bg-slate-800 border-slate-700 text-white" data-testid="select-list-standard">
                  <SelectValue placeholder="Select standard" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {STANDARD_OPTIONS.map(s => (
                    <SelectItem key={s} value={s} className="text-white focus:bg-slate-700">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Credit Type / Project</Label>
              <Select value={listForm.creditType} onValueChange={v => setListForm(f => ({ ...f, creditType: v }))}>
                <SelectTrigger className="mt-1 bg-slate-800 border-slate-700 text-white" data-testid="select-list-credit-type">
                  <SelectValue placeholder="Select credit type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {CREDIT_TYPE_OPTIONS.map(c => (
                    <SelectItem key={c} value={c} className="text-white focus:bg-slate-700">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-sm">Volume (Tonnes CO₂)</Label>
                <Input placeholder="e.g. 10000" value={listForm.volumeTonnes} onChange={e => setListForm(f => ({ ...f, volumeTonnes: e.target.value }))} className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" data-testid="input-list-volume" />
              </div>
              <div>
                <Label className="text-slate-300 text-sm">Asking Price (EUR/tonne)</Label>
                <Input placeholder="e.g. 65.00" value={listForm.askingPricePerTonne} onChange={e => setListForm(f => ({ ...f, askingPricePerTonne: e.target.value }))} className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" data-testid="input-list-price" />
              </div>
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Project Origin / Country</Label>
              <Input placeholder="e.g. Antigua, Caribbean" value={listForm.projectOrigin} onChange={e => setListForm(f => ({ ...f, projectOrigin: e.target.value }))} className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" data-testid="input-list-origin" />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Registry Serial Number (if available)</Label>
              <Input placeholder="e.g. VCS-1234-2024-001" value={listForm.registrySerial} onChange={e => setListForm(f => ({ ...f, registrySerial: e.target.value }))} className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" data-testid="input-list-serial" />
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              disabled={listMutation.isPending || !listForm.orgName || !listForm.contactName || !listForm.email || !listForm.standard || !listForm.creditType || !listForm.volumeTonnes || !listForm.askingPricePerTonne || !listForm.projectOrigin}
              onClick={() => listMutation.mutate(listForm)}
              data-testid="button-submit-list"
            >
              {listMutation.isPending ? 'Submitting...' : 'Submit for Verification'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
