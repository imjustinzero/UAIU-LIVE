import { useState } from "react";
import { useLocation } from "wouter";

const F = {
  playfair: "'Playfair Display', serif",
  syne: "'Syne', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

const C = {
  ink: '#060810',
  ink2: '#0d1220',
  ink3: '#141e30',
  gold: '#d4a843',
  gold2: '#f0c96a',
  goldborder: 'rgba(212,168,67,0.22)',
  cream: '#f2ead8',
  cream2: 'rgba(242,234,216,0.7)',
  cream3: 'rgba(242,234,216,0.35)',
  cream4: 'rgba(242,234,216,0.1)',
  green: '#22c55e',
  red: '#ef4444',
};

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleReset() {
    setError('');
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!token) {
      setError('Invalid reset link. No token provided.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/exchange/account/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to reset password.');
        return;
      }
      if (data.token) {
        localStorage.setItem('x-exchange-token', data.token);
        sessionStorage.setItem('x-exchange-token', data.token);
      }
      setSuccess(true);
      setTimeout(() => navigate('/x'), 2000);
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: C.ink,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  };

  const cardStyle: React.CSSProperties = {
    background: C.ink2,
    border: `1px solid ${C.goldborder}`,
    padding: '40px 36px',
    maxWidth: 420,
    width: '100%',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: `1px solid ${C.goldborder}`,
    color: C.cream,
    fontFamily: F.mono,
    fontSize: 12,
    padding: '10px 14px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: C.gold,
    marginBottom: 6,
    display: 'block',
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 20px',
    background: C.gold,
    border: 'none',
    color: C.ink,
    fontFamily: F.mono,
    fontSize: 11,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    fontWeight: 700,
    marginTop: 8,
    opacity: loading ? 0.6 : 1,
  };

  if (!token) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontFamily: F.playfair, fontSize: 22, fontWeight: 700, color: C.cream, marginBottom: 16 }}>Invalid Reset Link</div>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3, lineHeight: 1.6, marginBottom: 20 }}>
            This password reset link is invalid. Please request a new one from the sign-in page.
          </div>
          <button style={buttonStyle} onClick={() => navigate('/x')} data-testid="button-back-to-exchange">Back to Exchange</button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontFamily: F.playfair, fontSize: 22, fontWeight: 700, color: C.cream, marginBottom: 16 }}>Password Reset</div>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.green, lineHeight: 1.6 }} data-testid="text-reset-success">
            Your password has been reset successfully. Redirecting to the exchange...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontFamily: F.playfair, fontSize: 22, fontWeight: 700, color: C.cream, marginBottom: 6 }}>Set New Password</div>
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, letterSpacing: '0.05em', marginBottom: 24, lineHeight: 1.6 }}>
          Enter your new password below. Must be at least 8 characters.
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>New Password</label>
          <input
            style={{ ...inputStyle, borderColor: error ? 'rgba(239,68,68,0.5)' : undefined }}
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleReset(); }}
            autoFocus
            data-testid="input-reset-password"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Confirm Password</label>
          <input
            style={{ ...inputStyle, borderColor: error ? 'rgba(239,68,68,0.5)' : undefined }}
            type="password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleReset(); }}
            data-testid="input-reset-confirm-password"
          />
        </div>

        {error && <div style={{ fontFamily: F.mono, fontSize: 11, color: C.red, marginBottom: 12 }} data-testid="text-reset-error">{error}</div>}

        <button
          style={buttonStyle}
          onClick={handleReset}
          disabled={loading || !password}
          data-testid="button-reset-submit"
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>

        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream4, marginTop: 16, textAlign: 'center', letterSpacing: '0.05em' }}>
          <button onClick={() => navigate('/x')} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontFamily: F.mono, fontSize: 10, textDecoration: 'underline', padding: 0 }} data-testid="link-back-to-exchange">Back to Exchange</button>
        </div>
      </div>
    </div>
  );
}
