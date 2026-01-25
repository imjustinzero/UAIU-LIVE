import { useState, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, Mail, MessageSquare, Building, Users, FileText, ChevronRight, Shield, Clock, CheckCircle, Gamepad2, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import headshotImg from "@assets/E708457C-45C1-42BD-998F-FAD8F6A0EEFA_1769325184923.png";

export default function Landing() {
  const { toast } = useToast();
  const [activeForm, setActiveForm] = useState<'call' | 'company' | 'referral' | null>(null);
  
  const callFormRef = useRef<HTMLDivElement>(null);
  const companyFormRef = useRef<HTMLDivElement>(null);
  const referralFormRef = useRef<HTMLDivElement>(null);

  const scrollToForm = (form: 'call' | 'company' | 'referral') => {
    setActiveForm(form);
    setTimeout(() => {
      const ref = form === 'call' ? callFormRef : form === 'company' ? companyFormRef : referralFormRef;
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <main>
        <HeroSection onScrollToForm={scrollToForm} />
        <CTACards onScrollToForm={scrollToForm} />
        <ProcessSection />
        
        <div ref={callFormRef}>
          {activeForm === 'call' && <RequestCallForm onClose={() => setActiveForm(null)} />}
        </div>
        <div ref={companyFormRef}>
          {activeForm === 'company' && <CompanyForSaleForm onClose={() => setActiveForm(null)} />}
        </div>
        <div ref={referralFormRef}>
          {activeForm === 'referral' && <ReferralForm onClose={() => setActiveForm(null)} />}
        </div>
        
        <PlayGamesSection />
      </main>

      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b-4 border-amber-600 bg-gradient-to-r from-stone-800 to-stone-700">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-wide">JUSTIN ZARAGOZA</h1>
            <p className="text-amber-400 text-sm font-medium tracking-widest">PRINCIPAL BUYER | UAIU.LIVE</p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
            <a href="tel:8447892300" data-testid="link-call-main">
              <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                <Phone className="w-4 h-4 mr-2" />
                Call 844-789-2300
              </Button>
            </a>
            <a href="tel:5308085208" data-testid="link-call-direct">
              <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                <MessageSquare className="w-4 h-4 mr-2" />
                Text / Call 530-808-5208
              </Button>
            </a>
            <a href="mailto:uaiulive@gmail.com" data-testid="link-email">
              <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                <Mail className="w-4 h-4 mr-2" />
                Email uaiulive@gmail.com
              </Button>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

function HeroSection({ onScrollToForm }: { onScrollToForm: (form: 'call' | 'company' | 'referral') => void }) {
  return (
    <section className="relative bg-gradient-to-br from-stone-100 via-white to-stone-50 py-16 md:py-24 overflow-hidden">
      <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml,...')] bg-cover"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center max-w-6xl mx-auto">
          <div className="space-y-6">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-stone-900 leading-tight">
                Acquiring Cash-Flowing Construction & Trades Businesses
              </h2>
              <p className="text-xl text-stone-600 mt-3">in Northern California</p>
            </div>

            <ul className="space-y-3 text-stone-700">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <span><strong>$5M+ revenue preferred</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <span><strong>Profitable (EBITDA/SDE positive)</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <span>HVAC • Plumbing • Electrical • Concrete • Grading • Restoration • Roofing • GC • Other</span>
              </li>
            </ul>

            <p className="text-lg font-semibold text-stone-800 italic">
              Confidential. Fast Decisions.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => onScrollToForm('call')} 
                size="lg" 
                className="bg-amber-600 hover:bg-amber-700 text-white"
                data-testid="button-hero-request-call"
              >
                Request a Call
              </Button>
              <Button 
                onClick={() => onScrollToForm('company')} 
                variant="outline" 
                size="lg"
                className="border-stone-400"
                data-testid="button-hero-submit-company"
              >
                Submit a Company
              </Button>
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-200/50 to-transparent rounded-lg transform rotate-3"></div>
              <img 
                src={headshotImg} 
                alt="Justin Zaragoza - Principal Buyer" 
                className="relative rounded-lg shadow-2xl max-w-sm w-full object-cover"
                data-testid="img-headshot"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTACards({ onScrollToForm }: { onScrollToForm: (form: 'call' | 'company' | 'referral') => void }) {
  return (
    <section className="py-16 bg-gradient-to-b from-stone-50 to-white">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <Card className="hover-elevate border-2 hover:border-amber-500/50 transition-all cursor-pointer" onClick={() => onScrollToForm('call')} data-testid="card-request-call">
            <CardContent className="p-6 text-center space-y-4">
              <Phone className="w-12 h-12 mx-auto text-amber-600" />
              <h3 className="text-xl font-bold text-stone-900">Request a Call</h3>
              <p className="text-sm text-stone-600">Schedule a Confidential Consultation</p>
              <Button className="w-full bg-amber-600 hover:bg-amber-700">Submit Request</Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate border-2 hover:border-amber-500/50 transition-all cursor-pointer" onClick={() => onScrollToForm('company')} data-testid="card-present-company">
            <CardContent className="p-6 text-center space-y-4">
              <Building className="w-12 h-12 mx-auto text-stone-600" />
              <h3 className="text-xl font-bold text-stone-900">Present a Company For Sale</h3>
              <p className="text-sm text-stone-600">Submit Business Details & Documents</p>
              <Button variant="outline" className="w-full border-stone-400">Submit Company</Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate border-2 hover:border-amber-500/50 transition-all cursor-pointer" onClick={() => onScrollToForm('referral')} data-testid="card-referral">
            <CardContent className="p-6 text-center space-y-4">
              <Users className="w-12 h-12 mx-auto text-stone-600" />
              <h3 className="text-xl font-bold text-stone-900">Referral / Other</h3>
              <p className="text-sm text-stone-600">Make an Introduction</p>
              <Button variant="outline" className="w-full border-stone-400">Submit Referral</Button>
            </CardContent>
          </Card>

          <Card className="bg-stone-800 text-white" data-testid="card-confidential">
            <CardContent className="p-6 space-y-4">
              <Shield className="w-10 h-10 text-amber-400" />
              <h3 className="text-lg font-bold">Confidential & Discreet</h3>
              <p className="text-sm text-stone-300">
                Your information is kept strictly confidential. Serious owners only. No tire-kickers.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  const steps = [
    { num: 1, title: "Intro Call", desc: "10-15 Minutes" },
    { num: 2, title: "NDA & Financial Review", desc: "If needed" },
    { num: 3, title: "Clear LOI Range", desc: "Fast decisions" },
    { num: 4, title: "Diligence & Close", desc: "Professional process" },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-stone-900 mb-12">Our Process</h2>
        
        <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8 max-w-5xl mx-auto">
          {steps.map((step, i) => (
            <div key={step.num} className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-lg">
                  {step.num}
                </div>
                <div>
                  <div className="font-bold text-stone-900">{step.title}</div>
                  <div className="text-sm text-stone-500">{step.desc}</div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="w-6 h-6 text-stone-300 hidden md:block" />
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-stone-500 mt-8">
          Not a broker-dealer. Confidential discussions. This site is for initial introductions only.
        </p>
      </div>
    </section>
  );
}

function RequestCallForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    bestDays: [] as string[],
    timeWindow: '',
    timezone: 'Pacific',
    notes: '',
    honeypot: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.honeypot) return;
    
    if (!formData.fullName || !formData.phone || !formData.email || formData.bestDays.length === 0 || !formData.timeWindow) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('POST', '/api/forms/request-call', formData);
      setIsSuccess(true);
    } catch (error) {
      toast({ title: "Error", description: "Failed to submit. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <section className="py-16 bg-green-50">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-stone-900 mb-2">Request Received</h3>
          <p className="text-stone-600 mb-6">If it fits, you'll hear back within 1–2 business days.</p>
          <Button onClick={onClose} variant="outline">Close</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-stone-50" id="request-call">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3">
              <Phone className="w-6 h-6 text-amber-600" />
              Request a Call
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input type="text" name="website" className="hidden" value={formData.honeypot} onChange={e => setFormData(p => ({ ...p, honeypot: e.target.value }))} />
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input id="fullName" value={formData.fullName} onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))} required data-testid="input-call-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input id="phone" type="tel" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} required data-testid="input-call-phone" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} required data-testid="input-call-email" />
              </div>

              <div className="space-y-2">
                <Label>Best Days to Reach You *</Label>
                <div className="flex flex-wrap gap-3">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                    <label key={day} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox 
                        checked={formData.bestDays.includes(day)}
                        onCheckedChange={(checked) => {
                          setFormData(p => ({
                            ...p,
                            bestDays: checked ? [...p.bestDays, day] : p.bestDays.filter(d => d !== day)
                          }));
                        }}
                        data-testid={`checkbox-day-${day.toLowerCase()}`}
                      />
                      <span className="text-sm">{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Best Time Window *</Label>
                  <Select value={formData.timeWindow} onValueChange={v => setFormData(p => ({ ...p, timeWindow: v }))}>
                    <SelectTrigger data-testid="select-time-window">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Morning">Morning (8am-12pm)</SelectItem>
                      <SelectItem value="Midday">Midday (12pm-2pm)</SelectItem>
                      <SelectItem value="Afternoon">Afternoon (2pm-5pm)</SelectItem>
                      <SelectItem value="Evening">Evening (5pm-7pm)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Time Zone *</Label>
                  <Select value={formData.timezone} onValueChange={v => setFormData(p => ({ ...p, timezone: v }))}>
                    <SelectTrigger data-testid="select-timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pacific">Pacific (PT)</SelectItem>
                      <SelectItem value="Mountain">Mountain (MT)</SelectItem>
                      <SelectItem value="Central">Central (CT)</SelectItem>
                      <SelectItem value="Eastern">Eastern (ET)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea id="notes" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Anything else you'd like to share..." data-testid="textarea-call-notes" />
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={isSubmitting} data-testid="button-submit-call">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Submit Request
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function CompanyForSaleForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    yourName: '',
    role: '',
    companyName: '',
    industry: '',
    location: '',
    ttmRevenue: '',
    ebitda: '',
    askingPrice: '',
    reasonForSale: '',
    timing: '',
    sellerInvolvement: '',
    sellerInvolvementDetail: '',
    confidentialityConfirmed: false,
    honeypot: '',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > 50 * 1024 * 1024) {
      toast({ title: "Files too large", description: "Total file size must be under 50MB.", variant: "destructive" });
      return;
    }
    setFiles(selectedFiles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.honeypot) return;

    if (!formData.yourName || !formData.role || !formData.industry || !formData.location || 
        !formData.ttmRevenue || !formData.ebitda || !formData.timing || !formData.sellerInvolvement || 
        !formData.confidentialityConfirmed) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const formDataObj = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        formDataObj.append(key, String(value));
      });
      files.forEach(file => formDataObj.append('files', file));

      const response = await fetch('/api/forms/company-for-sale', {
        method: 'POST',
        body: formDataObj,
      });
      if (!response.ok) throw new Error('Submission failed');
      setIsSuccess(true);
    } catch (error) {
      toast({ title: "Error", description: "Failed to submit. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <section className="py-16 bg-green-50">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-stone-900 mb-2">Company Submitted</h3>
          <p className="text-stone-600 mb-6">Thank you. We'll review your submission and reach out if there's a fit.</p>
          <Button onClick={onClose} variant="outline">Close</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-stone-50" id="company-for-sale">
      <div className="container mx-auto px-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3">
              <Building className="w-6 h-6 text-amber-600" />
              Present a Company For Sale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input type="text" name="website" className="hidden" value={formData.honeypot} onChange={e => setFormData(p => ({ ...p, honeypot: e.target.value }))} />

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="yourName">Your Name *</Label>
                  <Input id="yourName" value={formData.yourName} onChange={e => setFormData(p => ({ ...p, yourName: e.target.value }))} required data-testid="input-company-name" />
                </div>
                <div className="space-y-2">
                  <Label>Your Role *</Label>
                  <Select value={formData.role} onValueChange={v => setFormData(p => ({ ...p, role: v }))}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Owner">Owner</SelectItem>
                      <SelectItem value="Broker">Broker</SelectItem>
                      <SelectItem value="Advisor">Advisor</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name (optional)</Label>
                  <Input id="companyName" value={formData.companyName} onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))} data-testid="input-company-company-name" />
                </div>
                <div className="space-y-2">
                  <Label>Industry *</Label>
                  <Select value={formData.industry} onValueChange={v => setFormData(p => ({ ...p, industry: v }))}>
                    <SelectTrigger data-testid="select-industry">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HVAC">HVAC</SelectItem>
                      <SelectItem value="Plumbing">Plumbing</SelectItem>
                      <SelectItem value="Electrical">Electrical</SelectItem>
                      <SelectItem value="Concrete">Concrete</SelectItem>
                      <SelectItem value="Grading/Earthwork">Grading/Earthwork</SelectItem>
                      <SelectItem value="Restoration">Restoration</SelectItem>
                      <SelectItem value="Roofing">Roofing</SelectItem>
                      <SelectItem value="Landscaping">Landscaping</SelectItem>
                      <SelectItem value="General Contractor">General Contractor</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location (City, State) *</Label>
                <Input id="location" value={formData.location} onChange={e => setFormData(p => ({ ...p, location: e.target.value }))} placeholder="e.g., Sacramento, CA" required data-testid="input-company-location" />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ttmRevenue">TTM Revenue ($) *</Label>
                  <Input id="ttmRevenue" type="number" value={formData.ttmRevenue} onChange={e => setFormData(p => ({ ...p, ttmRevenue: e.target.value }))} required data-testid="input-company-revenue" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ebitda">EBITDA or SDE ($) *</Label>
                  <Input id="ebitda" type="number" value={formData.ebitda} onChange={e => setFormData(p => ({ ...p, ebitda: e.target.value }))} required data-testid="input-company-ebitda" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="askingPrice">Asking Price ($)</Label>
                  <Input id="askingPrice" type="number" value={formData.askingPrice} onChange={e => setFormData(p => ({ ...p, askingPrice: e.target.value }))} data-testid="input-company-asking-price" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reasonForSale">Reason for Sale (optional)</Label>
                <Textarea id="reasonForSale" value={formData.reasonForSale} onChange={e => setFormData(p => ({ ...p, reasonForSale: e.target.value }))} data-testid="textarea-company-reason" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Timing *</Label>
                  <Select value={formData.timing} onValueChange={v => setFormData(p => ({ ...p, timing: v }))}>
                    <SelectTrigger data-testid="select-timing">
                      <SelectValue placeholder="Select timing" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Now">Now</SelectItem>
                      <SelectItem value="3-6 months">3–6 months</SelectItem>
                      <SelectItem value="6-12 months">6–12 months</SelectItem>
                      <SelectItem value="Exploring">Exploring</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Seller Involvement Post-Close *</Label>
                  <Select value={formData.sellerInvolvement} onValueChange={v => setFormData(p => ({ ...p, sellerInvolvement: v }))}>
                    <SelectTrigger data-testid="select-seller-involvement">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.sellerInvolvement === 'Yes' && (
                <div className="space-y-2">
                  <Label htmlFor="sellerDetail">Seller Involvement Details</Label>
                  <Input id="sellerDetail" value={formData.sellerInvolvementDetail} onChange={e => setFormData(p => ({ ...p, sellerInvolvementDetail: e.target.value }))} placeholder="Describe involvement..." data-testid="input-seller-detail" />
                </div>
              )}

              <div className="space-y-2">
                <Label>Upload Documents</Label>
                <div className="border-2 border-dashed border-stone-300 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 mx-auto text-stone-400 mb-2" />
                  <p className="text-sm text-stone-600 mb-2">Teaser/CIM, Financials, WIP Schedule, Equipment List</p>
                  <p className="text-xs text-stone-500 mb-3">PDF, XLSX, CSV, DOCX, Images. Max 15MB per file, 50MB total.</p>
                  <Input type="file" multiple accept=".pdf,.xlsx,.csv,.docx,.png,.jpg,.jpeg" onChange={handleFileChange} className="max-w-xs mx-auto" data-testid="input-company-files" />
                  {files.length > 0 && (
                    <p className="text-sm text-green-600 mt-2">{files.length} file(s) selected</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox 
                  checked={formData.confidentialityConfirmed}
                  onCheckedChange={(checked) => setFormData(p => ({ ...p, confidentialityConfirmed: !!checked }))}
                  id="confidentiality"
                  data-testid="checkbox-confidentiality"
                />
                <Label htmlFor="confidentiality" className="text-sm cursor-pointer">
                  I confirm I have the right to share these materials. *
                </Label>
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={isSubmitting} data-testid="button-submit-company">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Submit Company
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function ReferralForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    yourName: '',
    contact: '',
    referralInfo: '',
    notes: '',
    okToMention: false,
    honeypot: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.honeypot) return;

    if (!formData.yourName || !formData.contact || !formData.referralInfo || !formData.okToMention) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('POST', '/api/forms/referral', formData);
      setIsSuccess(true);
    } catch (error) {
      toast({ title: "Error", description: "Failed to submit. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <section className="py-16 bg-green-50">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-stone-900 mb-2">Referral Sent</h3>
          <p className="text-stone-600 mb-6">Thank you for the introduction. We appreciate your help.</p>
          <Button onClick={onClose} variant="outline">Close</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-stone-50" id="referral">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3">
              <Users className="w-6 h-6 text-amber-600" />
              Referral / Other
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input type="text" name="website" className="hidden" value={formData.honeypot} onChange={e => setFormData(p => ({ ...p, honeypot: e.target.value }))} />

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="refName">Your Name *</Label>
                  <Input id="refName" value={formData.yourName} onChange={e => setFormData(p => ({ ...p, yourName: e.target.value }))} required data-testid="input-referral-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refContact">Your Phone or Email *</Label>
                  <Input id="refContact" value={formData.contact} onChange={e => setFormData(p => ({ ...p, contact: e.target.value }))} required data-testid="input-referral-contact" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="referralInfo">Who are you referring? (Name + Company) *</Label>
                <Input id="referralInfo" value={formData.referralInfo} onChange={e => setFormData(p => ({ ...p, referralInfo: e.target.value }))} placeholder="e.g., John Smith, ABC Plumbing" required data-testid="input-referral-info" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refNotes">Notes (optional)</Label>
                <Textarea id="refNotes" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} data-testid="textarea-referral-notes" />
              </div>

              <div className="flex items-start gap-3">
                <Checkbox 
                  checked={formData.okToMention}
                  onCheckedChange={(checked) => setFormData(p => ({ ...p, okToMention: !!checked }))}
                  id="okToMention"
                  data-testid="checkbox-ok-to-mention"
                />
                <Label htmlFor="okToMention" className="text-sm cursor-pointer">
                  OK to mention my name when reaching out. *
                </Label>
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={isSubmitting} data-testid="button-submit-referral">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Send Referral
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function PlayGamesSection() {
  return (
    <section className="py-8 bg-gradient-to-r from-stone-800 to-stone-700">
      <div className="container mx-auto px-4 text-center">
        <Link href="/play">
          <Button size="lg" className="h-16 px-12 text-xl font-bold bg-amber-500 hover:bg-amber-600 text-stone-900" data-testid="button-play-games">
            <Gamepad2 className="w-6 h-6 mr-3" />
            PLAY UAIU LIVE GAMES
          </Button>
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-stone-900 text-white py-8">
      <div className="container mx-auto px-4 text-center space-y-4">
        <p className="text-sm text-stone-400">
          Not a broker-dealer. Confidential discussions. This site is for initial introductions only.
        </p>
        <p className="text-sm text-stone-500">
          © {new Date().getFullYear()} UAIU Holding Co. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
