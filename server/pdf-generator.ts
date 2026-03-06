import PDFDocument from "pdfkit";

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
      ["Volume",           `${trade.volume_tonnes.toLocaleString()} tonnes CO₂`],
      ["Price per Tonne",  `€${trade.price_eur_per_tonne.toFixed(2)}`],
      ["Gross Amount",     `€${trade.gross_eur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ["Platform Fee (0.75%)", `€${trade.fee_eur.toFixed(2)}`],
      ["Net Amount",       `€${(trade.gross_eur - trade.fee_eur).toFixed(2)}`],
      ["Settled At",       trade.settled_at || new Date().toISOString()],
      ["Buyer",            trade.buyer_email],
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
    y += 14;

    doc.font("Helvetica").fontSize(8).fillColor(cream3)
      .text("Verify this receipt independently at uaiu.live/verify/" + trade.trade_id, 50, y);
    y += 12;
    doc.font("Helvetica").fontSize(8).fillColor(cream3)
      .text("UAIU.LIVE/X — Caribbean Carbon Credit Exchange — info@uaiu.live", 50, y);

    doc.rect(0, 837, 595, 5).fill(gold);

    doc.end();
  });
}
