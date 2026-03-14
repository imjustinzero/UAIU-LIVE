import PDFDocument from "pdfkit";

const PLATFORM_VERSION = "UAIU.LIVE/X v1.0";

export interface SignatureForPDF {
  trade_id: string;
  signer_full_name: string;
  signer_email: string;
  signer_ip: string;
  signed_at: string;
  document_hash: string;
  contract_text_hash: string;
  platform_attestation: string;
}

export function generateSignatureCertificatePDF(sig: SignatureForPDF): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const gold = "#d4a843";
    const ink = "#060810";
    const cream = "#f2ead8";
    const cream3 = "#7a7060";

    doc.rect(0, 0, 595, 842).fill(ink);
    doc.rect(0, 0, 595, 5).fill(gold);

    doc.font("Helvetica-Bold").fontSize(22).fillColor(gold).text("UAIU.LIVE/X", 50, 40);
    doc.font("Helvetica").fontSize(11).fillColor(cream).text("Electronic Signature Record", 50, 68);

    doc.moveTo(50, 92).lineTo(545, 92).strokeColor(gold).lineWidth(0.5).stroke();

    doc.font("Helvetica").fontSize(9).fillColor(cream3);
    doc.text(`Trade ID: ${sig.trade_id}`, 50, 104);
    doc.text(`Generated: ${new Date().toISOString()}`, 50, 117);

    doc.font("Helvetica-Bold").fontSize(13).fillColor(gold).text("Signer Information", 50, 150);
    doc.moveTo(50, 167).lineTo(545, 167).strokeColor(gold).lineWidth(0.3).stroke();

    const rows = [
      ["Full Name", sig.signer_full_name],
      ["Email", sig.signer_email],
      ["IP Address", sig.signer_ip],
      ["Signed At (UTC)", sig.signed_at],
    ];

    let y = 177;
    rows.forEach(([label, value]) => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(cream3).text(label, 50, y);
      doc.font("Helvetica").fontSize(9).fillColor(cream).text(value, 220, y);
      y += 18;
    });

    y += 12;
    doc.moveTo(50, y).lineTo(545, y).strokeColor(gold).lineWidth(0.3).stroke();
    y += 16;

    doc.font("Helvetica-Bold").fontSize(13).fillColor(gold).text("Cryptographic Verification", 50, y);
    y += 18;
    doc.moveTo(50, y).lineTo(545, y).strokeColor(gold).lineWidth(0.3).stroke();
    y += 12;

    const hashRows = [
      ["Document Hash (SHA-256)", sig.document_hash],
      ["Contract Text Hash (SHA-256)", sig.contract_text_hash],
      ["Platform Attestation (SHA-256)", sig.platform_attestation],
    ];

    hashRows.forEach(([label, value]) => {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(cream3).text(label, 50, y);
      y += 12;
      doc.font("Helvetica").fontSize(7).fillColor(gold).text(value, 50, y, { width: 495 });
      y += 16;
    });

    y += 12;
    doc.moveTo(50, y).lineTo(545, y).strokeColor(gold).lineWidth(0.3).stroke();
    y += 16;

    doc.font("Helvetica-Bold").fontSize(13).fillColor(gold).text("Legal Notice", 50, y);
    y += 18;
    doc.font("Helvetica").fontSize(8).fillColor(cream3).text(
      "This document constitutes an electronic signature record under the US ESIGN Act (15 U.S.C. ch. 96) and EU eIDAS Regulation (EU No 910/2014). " +
      "The signer provided explicit consent and affirmative action to sign the referenced trade document. " +
      "The platform attestation hash cryptographically binds the signer identity, document content, and timestamp together, providing tamper-evident proof of the signature event. " +
      "This record is retained for 7 years from the date of signing in accordance with regulatory retention requirements.",
      50, y, { width: 495 }
    );

    y += 60;
    doc.moveTo(50, y).lineTo(545, y).strokeColor(gold).lineWidth(0.3).stroke();
    y += 14;

    doc.font("Helvetica").fontSize(8).fillColor(cream3)
      .text(`UAIU.LIVE/X — Caribbean Carbon Credit Exchange — info@uaiu.live`, 50, y);
    y += 12;
    doc.font("Helvetica").fontSize(7).fillColor(cream3)
      .text(`Platform: ${PLATFORM_VERSION}`, 50, y);

    doc.rect(0, 837, 595, 5).fill(gold);

    doc.end();
  });
}

export interface TradeForPDF {
  trade_id: string;
  side: string;
  standard: string;
  volume_tonnes: number;
  price_eur_per_tonne: number;
  gross_eur: number;
  fee_eur: number;
  receipt_hash: string;
  prev_receipt_hash: string;
  payment_intent_id: string;
  stripe_charge_id: string;
  settled_at: string;
  buyer_email: string;
  seller_email?: string;
  buyer_registry_account_id?: string;
  buyer_registry_name?: string;
  seller_registry_name?: string;
  seller_registry_serial?: string;
  vintage_year?: number;
  retirement_status?: string;
}

export function generateTradePDF(trade: TradeForPDF): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const gold = "#d4a843";
    const ink = "#060810";
    const cream = "#f2ead8";
    const cream3 = "#7a7060";

    doc.rect(0, 0, 595, 842).fill(ink);
    doc.rect(0, 0, 595, 5).fill(gold);

    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(22).fillColor(gold).text("UAIU.LIVE/X", 50, 40);
    doc.font("Helvetica").fontSize(11).fillColor(cream).text("Carbon Credit Trade Confirmation", 50, 68);

    doc.moveDown(0.5);
    doc.moveTo(50, 92).lineTo(545, 92).strokeColor(gold).lineWidth(0.5).stroke();

    doc.font("Helvetica").fontSize(9).fillColor(cream3);
    doc.text(`Trade ID: ${trade.trade_id}`, 50, 104);
    doc.text(`Generated: ${new Date().toISOString()}`, 50, 117);
    doc.text(`Settlement: T+1`, 50, 130);

    doc.moveDown(2);

    doc.font("Helvetica-Bold").fontSize(13).fillColor(gold).text("Trade Summary", 50, 155);
    doc.moveTo(50, 172).lineTo(545, 172).strokeColor(gold).lineWidth(0.3).stroke();

    const rows = [
      ["Side",             trade.side.toUpperCase()],
      ["Standard",         trade.standard],
      ["Vintage Year",     trade.vintage_year ? String(trade.vintage_year) : "N/A"],
      ["Volume",           `${trade.volume_tonnes.toLocaleString()} tonnes CO₂`],
      ["Price per Tonne",  `€${trade.price_eur_per_tonne.toFixed(2)}`],
      ["Gross Amount",     `€${trade.gross_eur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ["Platform Fee (0.75%)", `€${trade.fee_eur.toFixed(2)}`],
      ["Net Amount",       `€${(trade.gross_eur - trade.fee_eur).toFixed(2)}`],
      ["Settled At",       trade.settled_at || new Date().toISOString()],
      ["Buyer",            trade.buyer_email],
      ["Seller",           trade.seller_email || "N/A"],
      ["Retirement Status", trade.retirement_status || 'Retirement Pending — Due within 48 hours of settlement.'],
    ];

    let y = 182;
    rows.forEach(([label, value]) => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(cream3).text(label, 50, y);
      doc.font("Helvetica").fontSize(9).fillColor(cream).text(value, 220, y);
      y += 18;
    });

    y += 12;
    doc.moveTo(50, y).lineTo(545, y).strokeColor(gold).lineWidth(0.3).stroke();
    y += 16;

    doc.font("Helvetica-Bold").fontSize(13).fillColor(gold).text("Tamper-Evident Receipt Chain", 50, y);
    y += 20;
    doc.moveTo(50, y).lineTo(545, y).strokeColor(gold).lineWidth(0.3).stroke();
    y += 12;

    doc.font("Helvetica").fontSize(8).fillColor(cream3)
      .text("This section provides cryptographic proof of trade integrity. Each hash commits to the prior trade hash, forming an immutable chain verifiable without account access.", 50, y, { width: 495 });
    y += 30;

    const hashRows = [
      ["Receipt Hash (SHA-256)", trade.receipt_hash || "N/A"],
      ["Previous Receipt Hash",  trade.prev_receipt_hash || "genesis"],
      ["Stripe PaymentIntent ID", trade.payment_intent_id || "N/A"],
      ["Stripe Charge ID",       trade.stripe_charge_id || "N/A"],
    ];

    hashRows.forEach(([label, value]) => {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(cream3).text(label, 50, y);
      y += 12;
      doc.font("Helvetica").fontSize(7).fillColor(gold).text(value, 50, y, { width: 495 });
      y += 16;
    });

    y += 8;
    doc.moveTo(50, y).lineTo(545, y).strokeColor(gold).lineWidth(0.3).stroke();
    y += 16;

    doc.font("Helvetica-Bold").fontSize(13).fillColor(gold).text("Registry Transfer Instructions", 50, y);
    y += 18;
    doc.font("Helvetica").fontSize(8).fillColor(cream3).text(
      `Seller registry name and serial: ${trade.seller_registry_name || 'N/A'} / ${trade.seller_registry_serial || 'N/A'}\n` +
      `Buyer registry account ID and registry name: ${trade.buyer_registry_account_id || 'N/A'} / ${trade.buyer_registry_name || 'N/A'}\n` +
      `Volume in tonnes: ${trade.volume_tonnes}\nCredit standard: ${trade.standard}\nTrade ID: ${trade.trade_id}\nSettlement timestamp: ${trade.settled_at || new Date().toISOString()}\n` +
      `Instruction: Seller to transfer ${trade.volume_tonnes} ${trade.standard} credits from registry account ${trade.seller_registry_serial || 'N/A'} to buyer registry account ${trade.buyer_registry_account_id || 'N/A'} within 48 hours of settlement date ${(trade.settled_at || new Date().toISOString()).split('T')[0]}.`,
      50,
      y,
      { width: 495 }
    );
    y += 78;

    doc.moveTo(50, y).lineTo(545, y).strokeColor(gold).lineWidth(0.3).stroke();
    y += 14;

    doc.font("Helvetica").fontSize(8).fillColor(cream3)
      .text("Verify this receipt independently at uaiu.live/verify/" + trade.trade_id, 50, y);
    y += 12;
    doc.font("Helvetica").fontSize(8).fillColor(cream3)
      .text(`UAIU.LIVE/X — Caribbean Carbon Credit Exchange — info@uaiu.live`, 50, y);
    y += 12;
    doc.font("Helvetica").fontSize(7).fillColor(cream3)
      .text(`Platform: ${PLATFORM_VERSION}`, 50, y);

    doc.rect(0, 837, 595, 5).fill(gold);

    doc.end();
  });
}
