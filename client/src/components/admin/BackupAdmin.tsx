import { useState, useEffect } from "react";

type Props = { adminKey: string };

const C = {
  bg: '#05080f',
  surface: '#0d1a2e',
  surface2: '#111f35',
  border: '#1e3050',
  gold: '#d4a843',
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#eab308',
  blue: '#3b82f6',
  text: '#e2e8f0',
  muted: '#64748b',
};

type BackupRow = {
  id: string;
  filename: string;
  file_size_bytes: number | null;
  checksum_sha256: string | null;
  storage_path: string | null;
  storage_provider: string;
  upload_status: string;
  backup_type: string;
  triggered_by: string;
  error_message: string | null;
  verified_at: string | null;
  verify_status: string | null;
  created_at: string;
};

function formatBytes(n: number | null): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function statusVariant(s: string): { color: string; bg: string; border: string } {
  if (s === 'uploaded' || s === 'ok') return { color: C.green, bg: 'rgba(34,197,94,.12)', border: 'rgba(34,197,94,.3)' };
  if (s === 'upload_failed' || s === 'missing' || s === 'checksum_mismatch' || s === 'size_mismatch')
    return { color: C.red, bg: 'rgba(239,68,68,.12)', border: 'rgba(239,68,68,.3)' };
  if (s === 'local_only' || s === 'skipped_no_s3') return { color: C.yellow, bg: 'rgba(234,179,8,.12)', border: 'rgba(234,179,8,.3)' };
  return { color: C.muted, bg: 'rgba(100,116,139,.12)', border: 'rgba(100,116,139,.3)' };
}

function Chip({ label, s }: { label: string; s: string }) {
  const v = statusVariant(s);
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
      color: v.color, background: v.bg, border: `1px solid ${v.border}`, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

export function BackupAdmin({ adminKey }: Props) {
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [s3Configured, setS3Configured] = useState(false);
  const [bucketName, setBucketName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [lastTriggerResult, setLastTriggerResult] = useState<any>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, any>>({});

  async function load() {
    if (!adminKey) return;
    setLoading(true);
    try {
      const r = await fetch('/api/admin/backup/list', {
        headers: { 'X-Admin-Key': adminKey },
      });
      const d = await r.json();
      setBackups(d.backups || []);
      setS3Configured(!!d.s3Configured);
      setBucketName(d.bucketName || null);
    } finally {
      setLoading(false);
    }
  }

  async function triggerBackup() {
    setTriggerLoading(true);
    setLastTriggerResult(null);
    try {
      const r = await fetch('/api/admin/backup/trigger', {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
      });
      const d = await r.json();
      setLastTriggerResult({ ok: r.ok, ...d });
      await load();
    } finally {
      setTriggerLoading(false);
    }
  }

  async function verifyBackup(id: string) {
    setVerifyingId(id);
    try {
      const r = await fetch(`/api/admin/backup/verify/${id}`, {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
      });
      const d = await r.json();
      setVerifyResults(prev => ({ ...prev, [id]: d }));
      await load();
    } finally {
      setVerifyingId(null);
    }
  }

  useEffect(() => { load(); }, [adminKey]);

  const latestUpload = backups.find(b => b.upload_status === 'uploaded');

  return (
    <div style={{ color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Backups', value: backups.length, color: C.text },
          { label: 'Off-site (S3)', value: backups.filter(b => b.storage_provider === 's3').length, color: s3Configured ? C.green : C.yellow },
          { label: 'Upload Failures', value: backups.filter(b => b.upload_status === 'upload_failed').length, color: C.red },
          { label: 'S3 Storage', value: s3Configured ? 'Configured' : 'Not configured', color: s3Configured ? C.green : C.yellow },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* S3 config notice */}
      {!s3Configured && (
        <div data-testid="status-s3-not-configured"
          style={{ background: 'rgba(234,179,8,.08)', border: `1px solid rgba(234,179,8,.3)`, borderRadius: 6,
            padding: '12px 16px', marginBottom: 16, fontSize: 12, color: C.yellow, lineHeight: 1.6 }}>
          S3 off-site storage is not configured. Backups are stored in /tmp only and will be lost on redeploy.
          Set <code style={{ color: C.gold }}>S3_BACKUP_BUCKET</code>, <code style={{ color: C.gold }}>AWS_ACCESS_KEY_ID</code>,
          and <code style={{ color: C.gold }}>AWS_SECRET_ACCESS_KEY</code> to enable off-site backups.
          Cloudflare R2 (zero egress fees) is recommended — also set <code style={{ color: C.gold }}>S3_BACKUP_ENDPOINT</code>.
        </div>
      )}
      {s3Configured && bucketName && (
        <div data-testid="status-s3-configured"
          style={{ background: 'rgba(34,197,94,.06)', border: `1px solid rgba(34,197,94,.2)`, borderRadius: 6,
            padding: '10px 16px', marginBottom: 16, fontSize: 12, color: C.green }}>
          S3 storage active — bucket: <code style={{ color: C.gold }}>{bucketName}</code>. Backups are uploaded off-site automatically.
        </div>
      )}

      {/* Action row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          data-testid="button-trigger-backup"
          onClick={triggerBackup}
          disabled={triggerLoading}
          style={{ background: C.gold, color: '#05080f', border: 'none', borderRadius: 6,
            padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          {triggerLoading ? 'Backing up...' : 'Trigger Backup Now'}
        </button>
        <button
          data-testid="button-refresh-backups"
          onClick={load}
          disabled={loading}
          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted,
            borderRadius: 6, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        {latestUpload && (
          <div style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>
            Last successful upload: <span style={{ color: C.green }}>{new Date(latestUpload.created_at).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Trigger result */}
      {lastTriggerResult && (
        <div data-testid="status-trigger-result"
          style={{ background: lastTriggerResult.ok ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
            border: `1px solid ${lastTriggerResult.ok ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`,
            borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontSize: 12 }}>
          {lastTriggerResult.ok ? (
            <div>
              <div style={{ color: C.green, fontWeight: 700, marginBottom: 6 }}>Backup complete</div>
              <div style={{ color: C.muted, lineHeight: 1.8 }}>
                <div>File: <span style={{ color: C.text }}>{lastTriggerResult.filename}</span></div>
                <div>Size: <span style={{ color: C.text }}>{formatBytes(lastTriggerResult.fileSizeBytes)}</span></div>
                <div>Checksum: <span style={{ color: C.text, fontFamily: 'monospace' }}>{lastTriggerResult.checksumSha256?.slice(0, 32)}...</span></div>
                <div>Storage: <span style={{ color: C.text }}>{lastTriggerResult.storageProvider}</span> — <span style={{ color: C.text }}>{lastTriggerResult.uploadStatus}</span></div>
                {lastTriggerResult.s3Key && <div>S3 key: <span style={{ color: C.gold }}>{lastTriggerResult.s3Key}</span></div>}
              </div>
            </div>
          ) : (
            <div style={{ color: C.red }}>Backup failed: {lastTriggerResult.error}</div>
          )}
        </div>
      )}

      {/* Backup list */}
      {loading && !backups.length ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontSize: 13 }}>Loading backups...</div>
      ) : !backups.length ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontSize: 13,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6 }}>
          No backups yet. Click "Trigger Backup Now" to create the first backup.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {backups.map(b => (
            <div key={b.id} data-testid={`row-backup-${b.id}`}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
                padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4, wordBreak: 'break-all' }}>
                  {b.filename}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <Chip label={b.upload_status} s={b.upload_status} />
                  <Chip label={b.storage_provider} s={b.upload_status} />
                  <Chip label={b.backup_type} s="pending" />
                  {b.verify_status && <Chip label={`verify: ${b.verify_status}`} s={b.verify_status} />}
                </div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.8 }}>
                  <span>Size: {formatBytes(b.file_size_bytes)}</span>
                  {b.checksum_sha256 && (
                    <span style={{ marginLeft: 12 }}>
                      SHA-256: <span style={{ fontFamily: 'monospace' }}>{b.checksum_sha256.slice(0, 16)}...</span>
                    </span>
                  )}
                  {b.storage_path && (
                    <div style={{ marginTop: 2, wordBreak: 'break-all' }}>
                      Path: {b.storage_path}
                    </div>
                  )}
                  {b.verified_at && (
                    <div style={{ marginTop: 2, color: b.verify_status === 'ok' ? C.green : C.yellow }}>
                      Verified: {new Date(b.verified_at).toLocaleString()} — {b.verify_status}
                    </div>
                  )}
                  {b.error_message && (
                    <div style={{ marginTop: 4, color: C.red }}>{b.error_message}</div>
                  )}
                </div>
                {verifyResults[b.id] && (
                  <div data-testid={`verify-result-${b.id}`}
                    style={{ marginTop: 8, background: C.surface2, borderRadius: 4, padding: '8px 12px', fontSize: 11, color: C.muted }}>
                    <div style={{ color: verifyResults[b.id].verifyStatus === 'ok' ? C.green : C.red, fontWeight: 700, marginBottom: 4 }}>
                      Verify result: {verifyResults[b.id].verifyStatus}
                    </div>
                    {verifyResults[b.id].details?.reason && (
                      <div>{verifyResults[b.id].details.reason}</div>
                    )}
                    {verifyResults[b.id].details?.sizeMatch !== undefined && (
                      <div>Size match: {verifyResults[b.id].details.sizeMatch ? 'yes' : 'NO'}</div>
                    )}
                    {verifyResults[b.id].details?.checksumMatch !== undefined && (
                      <div>Checksum match: {verifyResults[b.id].details.checksumMatch ? 'yes' : 'NO'}</div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ fontSize: 11, color: C.muted, textAlign: 'right' }}>
                  {new Date(b.created_at).toLocaleDateString()}<br />
                  <span style={{ color: C.muted }}>{new Date(b.created_at).toLocaleTimeString()}</span>
                </div>
                <button
                  data-testid={`button-verify-${b.id}`}
                  onClick={() => verifyBackup(b.id)}
                  disabled={verifyingId === b.id}
                  style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted,
                    borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {verifyingId === b.id ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
