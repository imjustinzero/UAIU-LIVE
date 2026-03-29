import type { Express } from "express";
import { exec } from "child_process";
import { mkdirSync, readdirSync, statSync, unlinkSync, readFileSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { sendExchangeEmail } from "./email-service";
import { sendZohoEmail, isZohoConfigured } from "./zoho-mailer";
import { generateTradePDF } from "./pdf-generator";
import {
  isS3Configured,
  uploadToS3,
  pruneS3Backups,
  validateS3Access,
  classifyS3Error,
} from "./backup-storage";
import { runAllFormalPropertyVerifications } from "./formal-properties-routes";

const BACKUP_DIR = "/tmp/uaiu_backups";
const BACKUP_KEEP = 7;
const S3_BACKUP_KEEP = 30;
const BACKUP_ALERT_EMAIL = process.env.BACKUP_ALERT_EMAIL || "info@uaiu.live";

async function sendBackupFailureAlert(params: {
  filename: string;
  message: string;
  code?: string;
  detail?: string;
}): Promise<void> {
  const html = `<div style="font-family:Arial;background:#060810;color:#f2ead8;padding:24px"><h2 style="color:#d4a843">UAIU.LIVE/X — Backup Upload Failed</h2><ul><li><strong>Filename:</strong> ${params.filename}</li><li><strong>Error:</strong> ${params.message}</li><li><strong>Code:</strong> ${params.code || "unknown"}</li><li><strong>Detail:</strong> ${params.detail || "n/a"}</li><li><strong>Timestamp:</strong> ${new Date().toISOString()}</li></ul><p>Immediate action required: validate S3/R2 bucket + credentials and trigger a manual backup.</p></div>`;

  if (isZohoConfigured()) {
    const sent = await sendZohoEmail(
      BACKUP_ALERT_EMAIL,
      "[UAIU.LIVE/X] Backup Upload Failed",
      html,
    );
    if (sent) return;
  }

  await sendExchangeEmail("🚨 Backup Upload Failed", {
    Filename: params.filename,
    Error: params.message,
    Code: params.code || "unknown",
    Detail: params.detail || "n/a",
    Timestamp: new Date().toISOString(),
  });
}

export interface BackupResult {
  success: boolean;
  file?: string;
  filename?: string;
  checksumSha256?: string;
  fileSizeBytes?: number;
  s3Key?: string;
  storageProvider?: string;
  uploadStatus?: string;
  logId?: string;
  error?: string;
}

export async function triggerDatabaseBackup(
  triggeredBy: "cron" | "admin" = "cron",
  backupType: "scheduled" | "manual" = "scheduled"
): Promise<BackupResult> {
  return new Promise((resolve) => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.warn("[Backup] DATABASE_URL not set — skipping");
      return resolve({ success: false, error: "DATABASE_URL not set" });
    }

    mkdirSync(BACKUP_DIR, { recursive: true });
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    const filename = `uaiu_${timestamp}.sql`;
    const backupFile = path.join(BACKUP_DIR, filename);

    exec(`pg_dump "${dbUrl}" > "${backupFile}"`, async (err) => {
      if (err) {
        console.error("[Backup] pg_dump failed:", err.message);
        return resolve({ success: false, error: err.message });
      }

      // ── Compute checksum and file size ──────────────────────────────
      let checksumSha256 = "";
      let fileSizeBytes = 0;
      try {
        const buf = readFileSync(backupFile);
        fileSizeBytes = buf.length;
        checksumSha256 = createHash("sha256").update(buf).digest("hex");
      } catch (hashErr: any) {
        console.warn("[Backup] Could not compute checksum:", hashErr.message);
      }

      console.log(
        `[Backup] Local dump complete: ${filename} ` +
          `(${(fileSizeBytes / 1024).toFixed(1)} KB, ` +
          `sha256: ${checksumSha256.slice(0, 16)}...)`
      );

      // ── Insert initial backup_logs row ───────────────────────────────
      let logId = "";
      try {
        const logResult = await db.execute(sql`
          INSERT INTO backup_logs
            (filename, file_size_bytes, checksum_sha256,
             storage_path, storage_provider, upload_status,
             backup_type, triggered_by)
          VALUES
            (${filename}, ${fileSizeBytes}, ${checksumSha256},
             ${backupFile}, 'local', 'local_only',
             ${backupType}, ${triggeredBy})
          RETURNING id
        `);
        logId = (logResult as any).rows?.[0]?.id || "";
      } catch (logErr: any) {
        console.warn("[Backup] Could not write backup_logs:", logErr.message);
      }

      // ── Prune local backups ──────────────────────────────────────────
      try {
        const files = readdirSync(BACKUP_DIR)
          .filter((f) => f.startsWith("uaiu_") && f.endsWith(".sql"))
          .map((f) => ({
            name: f,
            time: statSync(path.join(BACKUP_DIR, f)).mtimeMs,
          }))
          .sort((a, b) => b.time - a.time);
        for (const old of files.slice(BACKUP_KEEP)) {
          unlinkSync(path.join(BACKUP_DIR, old.name));
          console.log(`[Backup] Pruned local backup: ${old.name}`);
        }
      } catch {
        /* ignore prune errors */
      }

      // ── S3 upload (if configured) ────────────────────────────────────
      let s3Key: string | undefined;
      let uploadStatus = "local_only";
      let storageProvider = "local";

      if (isS3Configured()) {
        const s3Validation = await validateS3Access();
        if (!s3Validation.ok) {
          const detail = s3Validation.detail || "";
          const message = s3Validation.message || "Bucket validation failed";
          const code = s3Validation.code || "unknown";
          console.error(`[Backup S3] Validation failed for bucket ${s3Validation.bucket || "(unset)"}: ${message} [code=${code}] [${detail}]`);
          uploadStatus = "upload_failed";
          if (logId) {
            await db
              .execute(sql`
                UPDATE backup_logs
                SET upload_status = 'upload_failed',
                    error_message = ${message}
                WHERE id = ${logId}
              `)
              .catch(() => {});
          }

          await sendBackupFailureAlert({
            filename,
            message,
            code,
            detail,
          }).catch((emailErr: any) => {
            console.error("[Backup S3] Failed to send backup failure alert:", emailErr.message);
          });
        } else {
          try {
            console.log(`[Backup S3] Uploading ${filename}...`);
            const s3Result = await uploadToS3(backupFile, filename);
          s3Key = s3Result.key;
          uploadStatus = "uploaded";
          storageProvider = "s3";

          if (logId) {
            await db
              .execute(sql`
                UPDATE backup_logs
                SET storage_path = ${s3Key},
                    storage_provider = 's3',
                    upload_status = 'uploaded'
                WHERE id = ${logId}
              `)
              .catch((e: any) =>
                console.warn("[Backup] backup_logs S3 update failed:", e.message)
              );
          }

          console.log(`[Backup S3] Uploaded to ${s3Key}`);

          // Prune remote backups
            await pruneS3Backups(S3_BACKUP_KEEP).catch((e: any) =>
              console.warn("[Backup S3] Remote prune failed:", e.message)
            );
          } catch (s3Err: any) {
            const parsed = classifyS3Error(s3Err);
            console.error(`[Backup S3] Upload failed: ${parsed.message} [code=${parsed.code}] [${parsed.detail}]`);
            uploadStatus = "upload_failed";
            if (logId) {
              await db
                .execute(sql`
                  UPDATE backup_logs
                  SET upload_status = 'upload_failed',
                      error_message = ${parsed.message}
                  WHERE id = ${logId}
                `)
                .catch(() => {});
            }

            await sendBackupFailureAlert({
              filename,
              message: parsed.message,
              code: parsed.code,
              detail: parsed.detail,
            }).catch((emailErr: any) => {
              console.error("[Backup S3] Failed to send backup failure alert:", emailErr.message);
            });
          }
        }
      } else {
        console.log(
          "[Backup] S3 not configured — stored locally only. " +
            "Set S3_BACKUP_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY for off-site storage."
        );
      }

      resolve({
        success: true,
        file: backupFile,
        filename,
        checksumSha256,
        fileSizeBytes,
        s3Key,
        storageProvider,
        uploadStatus,
        logId,
      });
    });
  });
}

export function startCronJobs(_app: Express): void {
  console.log("[Cron] Escrow watchdog started — 30-min interval (T+1 / 24h capture threshold)");

  // Daily database backup — 5 min after startup, then every 24h
  setTimeout(() => {
    triggerDatabaseBackup("cron", "scheduled").then((r) => {
      if (!r.success)
        console.warn("[Backup] Scheduled backup failed:", r.error);
      else
        console.log(
          `[Backup] Scheduled backup complete — ` +
            `${r.filename} (${r.uploadStatus}, provider: ${r.storageProvider})`
        );
    });

    setInterval(() => {
      triggerDatabaseBackup("cron", "scheduled").then((r) => {
        if (!r.success)
          console.warn("[Backup] Scheduled backup failed:", r.error);
        else
          console.log(
            `[Backup] Scheduled backup complete — ` +
              `${r.filename} (${r.uploadStatus}, provider: ${r.storageProvider})`
          );
      });
    }, 24 * 60 * 60 * 1000);
  }, 5 * 60 * 1000);

  // Escrow watchdog
  async function checkStuckEscrows(): Promise<void> {
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        console.warn("[Cron] Skipping stuck escrow check — STRIPE_SECRET_KEY not set");
        return;
      }

      // Retirement upload reminder — send once after 24h of no upload
      try {
        await db.execute(sql`ALTER TABLE retirement_upload_tokens ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ`).catch(() => {});
        const dueReminders = await db.execute(sql`
          SELECT id, trade_id, seller_email, created_at
          FROM retirement_upload_tokens
          WHERE used_at IS NULL
            AND reminder_sent_at IS NULL
            AND created_at <= NOW() - INTERVAL '24 hours'
          ORDER BY created_at ASC
          LIMIT 100
        `).catch(() => ({ rows: [] as any[] }));

        for (const token of ((dueReminders as any).rows || [])) {
          try {
            const tradeIdStr = String(token.trade_id || '');
            const sellerEmailStr = String(token.seller_email || '');
            const html = `<div style="font-family:Arial;background:#060810;color:#f2ead8;padding:24px"><h2 style="color:#d4a843">Reminder — Retirement Certificate Upload Pending</h2><p>Your retirement certificate upload is still pending for trade <strong>${tradeIdStr}</strong>.</p><p>Please use your original secure link from the initial email. If it has expired, contact <a href="mailto:desk@uaiu.live" style="color:#d4a843">desk@uaiu.live</a> immediately.</p><p style="font-size:11px;color:rgba(242,234,216,0.4)">UAIU.LIVE/X · uaiu.live/x</p></div>`;
            if (isZohoConfigured() && sellerEmailStr) {
              await sendZohoEmail(sellerEmailStr, `Reminder: retirement upload due — ${tradeIdStr}`, html);
            } else {
              await sendExchangeEmail('Retirement Upload Reminder', {
                'Trade ID': tradeIdStr,
                'Seller Email': sellerEmailStr,
              });
            }
            await db.execute(sql`UPDATE retirement_upload_tokens SET reminder_sent_at = NOW() WHERE id = ${String(token.id)}`);
          } catch (e: any) {
            console.error('[Cron] Retirement reminder send failed:', e.message);
          }
        }
      } catch (e: any) {
        console.error('[Cron] Retirement reminder check failed:', e.message);
      }

      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(stripeKey, {
        apiVersion: "2024-12-18.acacia" as any,
      });

      const twentyFourHoursAgo = Math.floor(
        (Date.now() - 24 * 60 * 60 * 1000) / 1000
      );
      const piList = await stripe.paymentIntents.list({ limit: 100 });
      const stuckPIs = piList.data.filter(
        (pi) =>
          pi.status === "requires_capture" &&
          pi.metadata?.escrow_type === "carbon_credit_t1" &&
          pi.created < twentyFourHoursAgo
      );

      if (stuckPIs.length === 0) {
        console.log("[Cron] No escrow trades past T+1 window");
        return;
      }

      console.log(`[Cron] Found ${stuckPIs.length} escrow PI(s) past T+1 window`);

      for (const pi of stuckPIs) {
        const trade_id = pi.metadata?.trade_id || "unknown";

        const existing = await db
          .execute(
            sql`SELECT id, status FROM escrow_settlements_log WHERE payment_intent_id = ${pi.id} LIMIT 1`
          )
          .catch(() => ({ rows: [] as any[] }));

        const existingRow = (existing as any).rows?.[0];
        if (existingRow?.status === 'dispute_hold') {
          console.log(`[Cron] PI ${pi.id} under dispute_hold — skipping capture`);
          continue;
        }
        if (existingRow?.status === 'payment_failed') {
          console.log(`[Cron] PI ${pi.id} payment failed — skipping capture`);
          continue;
        }
        if (existingRow?.status === 'auto_settled' || existingRow?.status === 'cron_settled') {
          console.log(`[Cron] PI ${pi.id} already settled — skipping`);
          continue;
        }

        try {
          const captured = await stripe.paymentIntents.capture(pi.id);
          const gross = captured.amount / 100;
          const uaiu_fee = gross * 0.0075;
          const seller_net = gross - uaiu_fee;

          await db
            .execute(
              sql`
              INSERT INTO escrow_settlements_log
                (trade_id, payment_intent_id, amount_eur, uaiu_fee_eur, seller_net_eur,
                 status, settled_at, stripe_charge_id)
              VALUES
                (${trade_id}, ${pi.id}, ${gross}, ${uaiu_fee}, ${seller_net},
                 'cron_settled', NOW(), ${captured.latest_charge as string})
              ON CONFLICT (payment_intent_id) DO UPDATE
                SET status = 'cron_settled', settled_at = NOW()
            `
            )
            .catch((e: any) => console.error("[Cron PG log]", e.message));

          const settled_at = new Date().toISOString();
          const buyer_email = pi.metadata?.buyer_email || pi.receipt_email || '';
          const charge_id = captured.latest_charge as string;

          await sendExchangeEmail(
            `[CRON T+1] Trade ${trade_id} — Settlement Complete`,
            {
              "Trade ID": trade_id,
              "PI ID": pi.id,
              Gross: `€${gross.toLocaleString()}`,
              "UAIU Fee (0.75%)": `€${uaiu_fee.toFixed(2)}`,
              "Net to Seller": `€${seller_net.toFixed(2)}`,
              "Settled By": "T+1 cron watchdog",
              "Settled At": settled_at,
            }
          ).catch(() => {});

          const receiptData = `${trade_id}:${pi.id}:${charge_id}:${gross}:${settled_at}`;
          const receiptHash = createHash('sha256').update(receiptData).digest('hex');
          let prevReceiptHash = 'GENESIS_BLOCK_UAIU_CARIBBEAN_CARBON_EXCHANGE';
          try {
            const prevRow = await db.execute(
              sql`SELECT receipt_hash FROM exchange_trades WHERE receipt_hash IS NOT NULL AND receipt_hash != '' ORDER BY created_at DESC LIMIT 1`
            );
            prevReceiptHash = (prevRow as any).rows?.[0]?.receipt_hash || prevReceiptHash;
          } catch {}

          generateTradePDF({
            trade_id,
            side: 'BUY',
            standard: pi.metadata?.standard || 'Carbon Credit',
            volume_tonnes: parseFloat(pi.metadata?.volume_tonnes || '0'),
            price_eur_per_tonne: gross / (parseFloat(pi.metadata?.volume_tonnes || '1') || 1),
            gross_eur: gross,
            fee_eur: uaiu_fee,
            receipt_hash: receiptHash,
            prev_receipt_hash: prevReceiptHash,
            payment_intent_id: pi.id,
            stripe_charge_id: charge_id,
            settled_at,
            buyer_email,
          }).then(pdfBuffer => {
            const recipients = ['info@uaiu.live'];
            if (buyer_email && buyer_email !== 'info@uaiu.live') recipients.push(buyer_email);
            const attachment = [{ filename: `UAIU-Trade-${trade_id}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
            const emailHtml = `<div style="font-family:Arial;background:#022c22;color:#ecfdf5;padding:20px"><h2 style="color:#34d399">UAIU.LIVE/X — T+1 Settlement Complete</h2><p>Trade <strong>${trade_id}</strong> has settled after the 24-hour escrow hold. Your audit pack PDF is attached.</p><p style="color:#6ee7b7;font-size:12px">UAIU Exchange — info@uaiu.live</p></div>`;
            if (isZohoConfigured()) {
              return sendZohoEmail(recipients.join(','), `UAIU Trade Settlement — ${trade_id}`, emailHtml, attachment);
            }
          }).catch((e: any) => console.error('[Cron PDF email]', e.message));

          console.log(
            `[Cron T+1] Captured PI ${pi.id} — Trade ${trade_id} — €${gross}`
          );
        } catch (captureErr: any) {
          console.error(
            `[Cron] Failed to capture PI ${pi.id}:`,
            captureErr.message
          );

          await sendExchangeEmail(
            "STUCK ESCROW — Capture Failed (Cron)",
            {
              "Trade ID": trade_id,
              "PI ID": pi.id,
              Amount: `€${(pi.amount / 100).toLocaleString()}`,
              "PI Created": new Date(pi.created * 1000).toISOString(),
              Error: captureErr.message,
              "Action Required": "Manual capture or investigation needed",
              Timestamp: new Date().toISOString(),
            }
          ).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error("[Cron] checkStuckEscrows error:", err.message);
    }
  }

  setTimeout(checkStuckEscrows, 60_000);
  setInterval(checkStuckEscrows, 30 * 60 * 1000);

  async function runFormalPropertyCron(): Promise<void> {
    try {
      const result = await runAllFormalPropertyVerifications();
      console.log(`[Cron] Formal properties verification complete: pass=${result.passed} fail=${result.failed} error=${result.errors}`);
      if (result.failed > 0 || result.errors > 0) {
        await sendExchangeEmail("[ALERT] Formal property verification failure", {
          Passed: result.passed,
          Failed: result.failed,
          Errors: result.errors,
          Timestamp: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (error: any) {
      console.error("[Cron] Formal property verification crashed:", error?.message || error);
    }
  }

  setTimeout(runFormalPropertyCron, 2 * 60 * 1000);
  setInterval(runFormalPropertyCron, 6 * 60 * 60 * 1000);
}
