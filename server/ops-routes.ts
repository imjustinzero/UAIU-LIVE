import type { Express } from 'express';
import { getOpsState, recordOpsEvent } from './ops-monitoring';
import { requireAdminHeader } from './exchange-auth';
import { triggerDatabaseBackup } from './cron';
import { isS3Configured, getS3BucketName, headS3Object, validateS3Access } from './backup-storage';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { storage } from './storage';

async function logAdminAction(req: any, type: string, message: string, details?: { affectedRecordId?: string; metadata?: Record<string, any> }): Promise<void> {
  try {
    const adminKey = String(req.headers['x-admin-key'] || '');
    const userId = adminKey
      ? createHash('sha256').update(adminKey).digest('hex').slice(0, 16)
      : 'unknown';
    const structuredMessage = JSON.stringify({
      action: type,
      affected_record_id: details?.affectedRecordId || null,
      notes: message,
      ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim(),
      timestamp: new Date().toISOString(),
      ...(details?.metadata || {}),
    });
    await storage.addActionLog({ userId, userName: 'admin', type, message: structuredMessage });
  } catch (_) {}
}

export function registerOpsRoutes(app: Express) {
  app.get('/api/admin/ops/overview', requireAdminHeader, (_req, res) => {
    const ops = getOpsState();
    const latency = Object.entries(ops.routeLatencyMs)
      .map(([route, v]) => ({ route, avgMs: Math.round(v.total / Math.max(v.count, 1)), maxMs: v.max, count: v.count }))
      .sort((a, b) => b.maxMs - a.maxMs)
      .slice(0, 25);
    res.json({
      uptimeSec: ops.uptimeSec,
      process: ops.process,
      counters: ops.counters,
      latency,
      recentEvents: ops.events.slice(0, 50),
    });
  });

  app.post('/api/admin/ops/maintenance-mode', requireAdminHeader, (req, res) => {
    const enabled = !!req.body?.enabled;
    process.env.TRADING_DISABLED = enabled ? '1' : '0';
    recordOpsEvent('maintenance_mode_changed', { enabled });
    logAdminAction(req, 'maintenance_mode', `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`).catch(() => {});
    res.json({ success: true, enabled });
  });

  // ── Backup: List all backup records ─────────────────────────────────────────
  app.get('/api/admin/backup/list', requireAdminHeader, async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, filename, file_size_bytes, checksum_sha256,
               storage_path, storage_provider, upload_status,
               backup_type, triggered_by, error_message,
               verified_at, verify_status, created_at
        FROM backup_logs
        ORDER BY created_at DESC
        LIMIT 50
      `);
      const backups = (result as any).rows || [];
      return res.json({
        backups,
        s3Configured: isS3Configured(),
        bucketName: getS3BucketName(),
        totalCount: backups.length,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });


  // ── Backup: Validate S3/R2 bucket credentials ─────────────────────────────
  app.get('/api/admin/backup/validate', requireAdminHeader, async (_req, res) => {
    const result = await validateS3Access();
    if (!result.ok) {
      return res.status(401).json({
        ok: false,
        bucket: result.bucket,
        code: result.code || 'Unauthorized',
        detail: result.detail || 'n/a',
        message: result.message || 'S3/R2 validation failed',
      });
    }

    return res.json({
      ok: true,
      bucket: result.bucket,
      s3Configured: isS3Configured(),
    });
  });

  // ── Backup: Trigger a manual backup ─────────────────────────────────────────
  app.post('/api/admin/backup/trigger', requireAdminHeader, async (req, res) => {
    const result = await triggerDatabaseBackup('admin', 'manual');
    logAdminAction(req, 'backup_trigger', `Manual backup triggered — success: ${result.success}, file: ${result.filename || 'n/a'}`).catch(() => {});
    recordOpsEvent('manual_backup_triggered', {
      success: result.success,
      filename: result.filename,
      uploadStatus: result.uploadStatus,
      storageProvider: result.storageProvider,
      fileSizeBytes: result.fileSizeBytes,
    });
    if (result.success) {
      return res.json({
        success: true,
        filename: result.filename,
        file: result.file,
        checksumSha256: result.checksumSha256,
        fileSizeBytes: result.fileSizeBytes,
        s3Key: result.s3Key || null,
        storageProvider: result.storageProvider,
        uploadStatus: result.uploadStatus,
        logId: result.logId,
      });
    }
    return res.status(500).json({ success: false, error: result.error });
  });

  // ── Backup: Verify a specific backup's integrity ─────────────────────────────
  app.post('/api/admin/backup/verify/:id', requireAdminHeader, async (req, res) => {
    try {
      const { id } = req.params;
      const logResult = await db.execute(sql`
        SELECT * FROM backup_logs WHERE id = ${id} LIMIT 1
      `);
      const backup = (logResult as any).rows?.[0];
      if (!backup) return res.status(404).json({ error: 'Backup record not found.' });

      let verifyStatus = 'unknown';
      let details: Record<string, any> = {
        id: backup.id,
        filename: backup.filename,
        storageProvider: backup.storage_provider,
        storagePath: backup.storage_path,
        expectedChecksum: backup.checksum_sha256,
        expectedSize: backup.file_size_bytes,
      };

      if (backup.storage_provider === 's3' && backup.storage_path) {
        // S3 verification: confirm object exists + size matches
        if (!isS3Configured()) {
          verifyStatus = 'skipped_no_s3';
          details.reason = 'S3 not configured in this environment.';
        } else {
          try {
            const head = await headS3Object(backup.storage_path);
            if (!head) {
              verifyStatus = 'missing';
              details.reason = 'Object not found in S3.';
            } else {
              const sizeMatch = !backup.file_size_bytes || head.size === backup.file_size_bytes;
              verifyStatus = sizeMatch ? 'ok' : 'size_mismatch';
              details.s3Size = head.size;
              details.s3Etag = head.etag;
              details.sizeMatch = sizeMatch;
            }
          } catch (s3Err: any) {
            verifyStatus = 'error';
            details.error = s3Err.message;
          }
        }
      } else if (backup.storage_provider === 'local' && backup.storage_path) {
        // Local verification: check file exists + recompute checksum
        if (!existsSync(backup.storage_path)) {
          verifyStatus = 'missing';
          details.reason = 'Local file not found (may have been pruned or lost on redeploy).';
        } else {
          try {
            const buf = readFileSync(backup.storage_path);
            const actualChecksum = createHash('sha256').update(buf).digest('hex');
            const checksumMatch = !backup.checksum_sha256 || actualChecksum === backup.checksum_sha256;
            const sizeMatch = !backup.file_size_bytes || buf.length === backup.file_size_bytes;
            verifyStatus = checksumMatch && sizeMatch ? 'ok' : 'checksum_mismatch';
            details.actualChecksum = actualChecksum;
            details.actualSize = buf.length;
            details.checksumMatch = checksumMatch;
            details.sizeMatch = sizeMatch;
          } catch (fsErr: any) {
            verifyStatus = 'error';
            details.error = fsErr.message;
          }
        }
      } else {
        verifyStatus = 'no_storage_path';
        details.reason = 'No storage path recorded for this backup.';
      }

      // Persist verification result
      await db.execute(sql`
        UPDATE backup_logs
        SET verified_at = NOW(), verify_status = ${verifyStatus}
        WHERE id = ${id}
      `).catch((e: any) => console.warn('[Backup verify] Could not update backup_logs:', e.message));

      recordOpsEvent('backup_verified', { id, verifyStatus });
      logAdminAction(req, 'backup_verify', `Backup ${id} verified — status: ${verifyStatus}`).catch(() => {});

      return res.json({ id, verifyStatus, details });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/status/public', async (_req, res) => {
    try {
      const ops = getOpsState();
      const platformStatus = process.env.PLATFORM_STATUS || 'ok';
      const tradingEnabled = process.env.TRADING_ENABLED !== 'false' && process.env.TRADING_DISABLED !== '1';
      const message =
        platformStatus === 'ok'
          ? 'Platform operating normally.'
          : platformStatus === 'maintenance'
          ? 'Platform is under scheduled maintenance.'
          : 'Platform status requires operator attention.';

      // Derive backup storage status from the last real backup attempt — not
      // just whether the env vars are set.
      let backupStorageStatus = 'local_only';
      if (isS3Configured()) {
        try {
          const result = await db.execute(sql`
            SELECT upload_status FROM backup_logs
            ORDER BY created_at DESC LIMIT 1
          `);
          const lastRow = ((result as any).rows || [])[0];
          if (!lastRow) {
            // S3 is configured but no backup has run yet
            backupStorageStatus = 'pending_first_run';
          } else if (lastRow.upload_status === 'uploaded') {
            backupStorageStatus = 'operational';
          } else if (lastRow.upload_status === 'upload_failed') {
            backupStorageStatus = 'degraded';
          } else {
            // local-only row (upload_status = 'local')
            backupStorageStatus = 'local_only';
          }
        } catch {
          backupStorageStatus = 'unknown';
        }
      }

      res.setHeader('cache-control', 'no-store');
      res.json({
        platform: 'UAIU.LIVE/X',
        status: platformStatus === 'ok' ? 'operational' : platformStatus,
        tradingEnabled,
        message,
        updatedAt: new Date().toISOString(),
        uptimeSec: ops.uptimeSec,
        components: [
          { name: 'Exchange API', status: 'operational' },
          { name: 'Trading Auth', status: 'operational' },
          { name: 'Webhooks', status: 'operational' },
          { name: 'AI Services', status: process.env.ANTHROPIC_API_KEY ? 'operational' : 'unavailable' },
          { name: 'Backup Storage', status: backupStorageStatus },
        ],
      });
    } catch (error: any) {
      res.status(500).json({
        platform: 'UAIU.LIVE/X',
        status: 'degraded',
        message: error?.message || 'Status endpoint failed',
        updatedAt: new Date().toISOString(),
        components: [],
      });
    }
  });
}
