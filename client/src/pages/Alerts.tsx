import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Deadline = {
  framework: string;
  dueDate: string;
  daysRemaining: number;
};

const frameworkOptions = [
  'EU ETS Maritime',
  'EU ETS Aviation',
  'CORSIA',
  'IMO CII',
  'FuelEU Maritime',
  'CBAM',
  'UK ETS',
  'SEC Climate Disclosure',
  'All frameworks',
];

const timingOptions = ['90 days before', '60 days before', '30 days before', '7 days before'];

export default function AlertsPage() {
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [sector, setSector] = useState('Corporate');
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [alertTiming, setAlertTiming] = useState<string[]>(['30 days before']);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
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
        body: JSON.stringify({
          email,
          organization,
          sector,
          frameworks,
          alertTiming,
          source: 'public_alerts_page',
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(payload?.error || 'Subscription failed.');
        return;
      }
      setStatus('Subscription received. Please confirm via email.');
      setEmail('');
      setOrganization('');
      setFrameworks([]);
      setAlertTiming(['30 days before']);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-foreground">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Carbon Compliance Deadline Alerts</CardTitle>
          <CardDescription>
            Free regulatory reminders for EU ETS, CORSIA, IMO, FuelEU and more. Never miss a compliance deadline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="work-email">Work email</Label>
              <Input id="work-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org">Organization name</Label>
              <Input id="org" required value={organization} onChange={(e) => setOrganization(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Sector</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Shipping">Shipping</SelectItem>
                  <SelectItem value="Aviation">Aviation</SelectItem>
                  <SelectItem value="Industrial">Industrial</SelectItem>
                  <SelectItem value="Corporate">Corporate</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Frameworks</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {frameworkOptions.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={frameworks.includes(option)} onCheckedChange={() => setFrameworks((prev) => toggleValue(prev, option))} />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Alert timing</Label>
              <div className="flex flex-wrap gap-4">
                {timingOptions.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={alertTiming.includes(option)} onCheckedChange={() => setAlertTiming((prev) => toggleValue(prev, option))} />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={!canSubmit || submitting}>{submitting ? 'Subscribing...' : 'Subscribe'}</Button>
            {status && <p className="text-sm text-muted-foreground">{status}</p>}
          </form>
        </CardContent>
      </Card>

      <section className="mt-8 grid gap-3">
        <h2 className="text-xl font-semibold">Upcoming deadlines</h2>
        {deadlines.map((deadline) => (
          <Card key={`${deadline.framework}-${deadline.dueDate}`}>
            <CardContent className="flex items-center justify-between py-4 text-sm">
              <span>{deadline.framework} — {deadline.dueDate}</span>
              <span className="font-medium">{deadline.daysRemaining} days</span>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
