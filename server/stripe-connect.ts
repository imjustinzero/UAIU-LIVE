import type { Express, Request } from "express";

export function getBaseUrl(req: Request): string {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5000";
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  const { default: Stripe } = await import("stripe");
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
}

export async function createConnectAccount(email: string, country = "US"): Promise<string> {
  const stripe = await getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    country,
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    settings: {
      payouts: { schedule: { interval: "manual" } },
    },
  });
  return account.id;
}

export async function createOnboardingLink(accountId: string, baseUrl: string): Promise<string> {
  const stripe = await getStripe();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/x/seller?refresh=1`,
    return_url: `${baseUrl}/x/seller?connect=success`,
    type: "account_onboarding",
  });
  return link.url;
}

export async function getConnectAccountStatus(accountId: string) {
  const stripe = await getStripe();
  const acct = await stripe.accounts.retrieve(accountId);
  return {
    id: acct.id,
    detailsSubmitted: acct.details_submitted,
    chargesEnabled: acct.charges_enabled,
    payoutsEnabled: acct.payouts_enabled,
    requirementsDue: acct.requirements?.currently_due ?? [],
    requirementsEventually: acct.requirements?.eventually_due ?? [],
    disabledReason: acct.requirements?.disabled_reason ?? null,
    ready: acct.details_submitted && acct.payouts_enabled,
  };
}

export async function createTransfer(
  amountEur: number,
  destinationAccountId: string,
  tradeId: string,
  sellerEmail: string
): Promise<{ id: string }> {
  // Fallback path only.
  // Primary settlement model is Stripe destination charges using:
  // payment_intent_data.application_fee_amount + transfer_data.destination
  // so funds never rest in the platform balance.
  const stripe = await getStripe();
  const transfer = await stripe.transfers.create({
    amount: Math.round(amountEur * 100),
    currency: "eur",
    destination: destinationAccountId,
    transfer_group: tradeId,
    metadata: { trade_id: tradeId, seller_email: sellerEmail },
  });
  return { id: transfer.id };
}
