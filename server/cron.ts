import type { Express } from "express";
import { exec } from "child_process";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import path from "path";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { sendExchangeEmail } from "./email-service";

const BACKUP_DIR = "/tmp/uaiu_backups";
const BACKUP_KEEP = 7;

export async function triggerDatabaseBackup(): Promise<{ success: boolean; file?: string; error?: string }> {
  return new Promise((resolve) => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.warn("[Backup] DATABASE_URL not set — skipping");
      return resolve({ success: false, error: "DATABASE_URL not set" });
    }
    mkdirSync(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    const backupFile = path.join(BACKUP_DIR, `uaiu_${timestamp}.sql`);
    exec(`pg_dump "${dbUrl}" > "${backupFile}"`, (err) => {
      if (err) {
        console.error("[Backup] pg_dump failed:", err.message);
        return resolve({ success: false, error: err.message });
      }
      console.log(`[Backup] ✅ Database backed up → ${backupFile}`);
      try {
        const files = readdirSync(BACKUP_DIR)
          .filter(f => f.startsWith("uaiu_") && f.endsWith(".sql"))
          .map(f => ({ name: f, time: statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
          .sort((a, b) => b.time - a.time);
        for (const old of files.slice(BACKUP_KEEP)) {
          unlinkSync(path.join(BACKUP_DIR, old.name));
          console.log(`[Backup] Pruned old backup: ${old.name}`);
        }
      } catch { /* ignore prune errors */ }
      resolve({ success: true, file: backupFile });
    });
  });
}

export function startCronJobs(_app: Express): void {
  console.log("[Cron] ✅ Escrow watchdog started — 30-min interval");

  // Daily database backup at startup + every 24h
  setTimeout(() => {
    triggerDatabaseBackup().then(r => {
      if (!r.success) console.warn("[Backup] Scheduled backup failed:", r.error);
    });
    setInterval(() => {
      triggerDatabaseBackup().then(r => {
        if (!r.success) console.warn("[Backup] Scheduled backup failed:", r.error);
      });
    }, 24 * 60 * 60 * 1000);
  }, 5 * 60 * 1000); // first backup 5 min after startup


  async function checkStuckEscrows(): Promise<void> {
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        console.warn("[Cron] Skipping stuck escrow check — STRIPE_SECRET_KEY not set");
        return;
      }

      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" as any });

      const thirtyMinutesAgo = Math.floor((Date.now() - 30 * 60 * 1000) / 1000);

      const piList = await stripe.paymentIntents.list({ limit: 100 });
      const stuckPIs = piList.data.filter(
        (pi) =>
          pi.status === "requires_capture" &&
          pi.metadata?.escrow_type === "carbon_credit_t1" &&
          pi.created < thirtyMinutesAgo
      );

      if (stuckPIs.length === 0) {
        console.log("[Cron] No stuck escrow trades found");
        return;
      }

      console.log(`[Cron] Found ${stuckPIs.length} stuck escrow PI(s)`);

      for (const pi of stuckPIs) {
        const trade_id = pi.metadata?.trade_id || "unknown";

        const existing = await db.execute(sql`
          SELECT id FROM escrow_settlements_log WHERE payment_intent_id = ${pi.id} LIMIT 1
        `).catch(() => ({ rows: [] as any[] }));

        if ((existing as any).rows?.length > 0) {
          console.log(`[Cron] PI ${pi.id} already settled — skipping`);
          continue;
        }

        try {
          const captured = await stripe.paymentIntents.capture(pi.id);
          const gross = captured.amount / 100;
          const uaiu_fee = gross * 0.0075;
          const seller_net = gross - uaiu_fee;

          await db.execute(sql`
            INSERT INTO escrow_settlements_log
              (trade_id, payment_intent_id, amount_eur, uaiu_fee_eur, seller_net_eur,
               status, settled_at, stripe_charge_id)
            VALUES
              (${trade_id}, ${pi.id}, ${gross}, ${uaiu_fee}, ${seller_net},
               'cron_settled', NOW(), ${captured.latest_charge as string})
            ON CONFLICT (payment_intent_id) DO UPDATE
              SET status = 'cron_settled', settled_at = NOW()
          `).catch((e: any) => console.error("[Cron PG log]", e.message));

          await sendExchangeEmail(`[CRON] Trade ${trade_id} — Auto-Settled`, {
            "Trade ID":         trade_id,
            "PI ID":            pi.id,
            "Gross":            `€${gross.toLocaleString()}`,
            "UAIU Fee (0.75%)": `€${uaiu_fee.toFixed(2)}`,
            "Net to Seller":    `€${seller_net.toFixed(2)}`,
            "Settled By":       "Cron watchdog",
            "Settled At":       new Date().toISOString(),
          }).catch(() => {});

          console.log(`[Cron] ✅ Captured stuck PI ${pi.id} — Trade ${trade_id}`);
        } catch (captureErr: any) {
          console.error(`[Cron] ❌ Failed to capture PI ${pi.id}:`, captureErr.message);

          await sendExchangeEmail("🚨 STUCK ESCROW — Capture Failed (Cron)", {
            "Trade ID":      trade_id,
            "PI ID":         pi.id,
            "Amount":        `€${(pi.amount / 100).toLocaleString()}`,
            "PI Created":    new Date(pi.created * 1000).toISOString(),
            "Error":         captureErr.message,
            "Action Required": "Manual capture or investigation needed",
            "Timestamp":     new Date().toISOString(),
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error("[Cron] checkStuckEscrows error:", err.message);
    }
  }

  setTimeout(checkStuckEscrows, 60_000);
  setInterval(checkStuckEscrows, 30 * 60 * 1000);
}
