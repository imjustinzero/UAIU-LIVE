import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle } from 'lucide-react';
import PublicPageShell from '@/components/PublicPageShell';

type Deadline = { framework: string; dueDate: string; daysRemaining: number };

const frameworkOptions = [
  'EU ETS Maritime', 'EU ETS Aviation', 'CORSIA', 'IMO CII',
  'FuelEU Maritime', 'CBAM', 'UK ETS', 'SEC Climate Disclosure', 'All frameworks',
];
const timingOptions = ['90 days before', '60 days before', '30 days before', '7 days before'];

const C = { card: '#0f1623', border: '#1e293b', gold: '#facc15', muted: '#94a3b8', text: '#f2ead8', green: '#22c55e' };

export default function AlertsPage() {
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [sector, setSector] = useState('Corporate');
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [alertTiming, setAlertTiming] = useState<string[]>(['30 days before']);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('confirmed') === '1') setConfirmed(true);
    fetch('/api/alerts/public-deadlines', { cache: 'no-store' })
      .then((r) => r.json())
      .then((payload) => setDeadlines(Array.isArray(payload?.deadlines) ? payload.deadlines : []))
      .catch(() => setDeadlines([]));
  }, []);

  const canSubmit = useMemo(() => email && organization && frameworks.length > 0 && alertTiming.length > 0, [email, organization, frameworks, alertTiming]);
  const toggleValue = (current: string[], next: string) =>
    current.includes(next) ? current.filter((v) => v !== next) : [...current, next];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      setStatus('');
      const response = await fetch('/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, organization, sector, frameworks, alertTiming, source: 'public_alerts_page' }),
      });
      const payload = await response.json();
      if (!response.ok) { setStatus(payload?.error || 'Subscription failed.'); return; }
      setStatus('Subscription received. Please confirm via the email we sent you.');
      setEmail(''); setOrganization(''); setFrameworks([]); setAlertTiming(['30 days before']);
    } finally { setSubmitting(false); }
  };

  return (
    <PublicPageShell
      title="Carbon Compliance Deadline Alerts | UAIU.LIVE"
      description="Free regulatory deadline reminders for EU ETS, CORSIA, IMO CII, and FuelEU. Subscribe to receive advance alerts before each compliance deadline."
      path="/alerts"
    >
      {confirmed && (
        <div data-testid="status-alert-confirmed" style={{ background: '#14532d', border: `1px solid #166534`, borderRadius: 8, padding: '14px 20px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle size={18} color={C.green} />
          <span style={{ color: C.green, fontWeight: 600 }}>Your email is confirmed. Compliance alerts are now active.</span>
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(22px, 4vw, 32px)', color: C.gold, margin: '0 0 8px' }}>
          Carbon Compliance Deadline Alerts
        </h1>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
          Free regulatory reminders for EU ETS, CORSIA, IMO, FuelEU and more. Never miss a compliance deadline.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24, maxWidth: 640 }}>
        <Card style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <CardHeader>
            <CardTitle style={{ color: C.text }}>Subscribe to Alerts</CardTitle>
            <CardDescription style={{ color: C.muted }}>Enter your details to receive advance warnings before each deadline.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <Label style={{ color: C.muted, fontSize: 12 }}>Work email</Label>
                <Input data-testid="input-alert-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ background: '#0a0e1a', border: `1px solid ${C.border}`, color: C.text }} />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <Label style={{ color: C.muted, fontSize: 12 }}>Organization name</Label>
                <Input data-testid="input-alert-org" required value={organization} onChange={(e) => setOrganization(e.target.value)} style={{ background: '#0a0e1a', border: `1px solid ${C.border}`, color: C.text }} />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <Label style={{ color: C.muted, fontSize: 12 }}>Sector</Label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger style={{ background: '#0a0e1a', border: `1px solid ${C.border}`, color: C.text }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Shipping', 'Aviation', 'Industrial', 'Corporate', 'Other'].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <Label style={{ color: C.muted, fontSize: 12 }}>Frameworks to track</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {frameworkOptions.map((option) => (
                    <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text, cursor: 'pointer' }}>
                      <Checkbox checked={frameworks.includes(option)} onCheckedChange={() => setFrameworks((prev) => toggleValue(prev, option))} />
                      {option}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <Label style={{ color: C.muted, fontSize: 12 }}>Alert timing</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {timingOptions.map((option) => (
                    <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text, cursor: 'pointer' }}>
                      <Checkbox checked={alertTiming.includes(option)} onCheckedChange={() => setAlertTiming((prev) => toggleValue(prev, option))} />
                      {option}
                    </label>
                  ))}
                </div>
              </div>
              <Button data-testid="button-alert-subscribe" type="submit" disabled={!canSubmit || submitting} style={{ background: C.gold, color: '#111827', fontWeight: 700 }}>
                {submitting ? 'Subscribing...' : 'Subscribe to Alerts'}
              </Button>
              {status && <p data-testid="status-alert-message" style={{ fontSize: 13, color: C.green, margin: 0 }}>{status}</p>}
            </form>
          </CardContent>
        </Card>
      </div>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.gold, marginBottom: 16 }}>Upcoming Deadlines</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {deadlines.map((deadline) => (
            <div key={`${deadline.framework}-${deadline.dueDate}`} data-testid={`card-deadline-${deadline.framework}`} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ color: C.text, fontSize: 14 }}>{deadline.framework} — {deadline.dueDate}</span>
              <span style={{ color: deadline.daysRemaining <= 30 ? '#ef4444' : deadline.daysRemaining <= 90 ? '#f59e0b' : C.green, fontWeight: 600, fontSize: 14 }}>
                {deadline.daysRemaining} days
              </span>
            </div>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}
