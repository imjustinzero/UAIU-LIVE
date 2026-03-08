const pageShell = require('./shared/pageShell');

module.exports = function baseTemplate(titleText) {
  const title = `<div class="header"><div><strong>UAIU Holdings Corp</strong>  |  <strong>UAIU.LIVE/X</strong></div><div class="title">${titleText}</div><div class="meta">Trade ID: {{trade_id}}  |  Ref: {{document_ref_number}}</div><div class="meta">Generated: {{generation_timestamp}} UTC</div><div class="meta">{{is_draft_label}}</div></div>`;
  const body = `<p><strong>Trade Parties</strong>: {{buyer_entity_name}} (Buyer) and {{seller_entity_name}} (Seller).</p>
  <table><tbody>
    <tr><th>Project</th><td>{{project_name}}</td></tr>
    <tr><th>Credit Type</th><td>{{credit_type}}</td></tr>
    <tr><th>Methodology</th><td>{{methodology}}</td></tr>
    <tr><th>Vintage</th><td>{{vintage}}</td></tr>
    <tr><th>Quantity</th><td>{{quantity}}</td></tr>
    <tr><th>Price Per Credit</th><td>{{price_per_credit}} {{currency}}</td></tr>
    <tr><th>Total Price</th><td>{{total_trade_price}} {{currency}}</td></tr>
    <tr><th>Settlement Date</th><td>{{settlement_date}}</td></tr>
    <tr><th>Delivery Deadline</th><td>{{delivery_deadline}}</td></tr>
    <tr><th>Serial Numbers</th><td>{{serial_numbers}}</td></tr>
  </tbody></table>
  <p><strong>Intended Use</strong>: {{intended_use}}</p>
  <p><strong>Escrow Path</strong>: {{escrow_path}} | Required: {{escrow_required}}</p>
  <p><strong>Escrow Release Conditions</strong>: {{escrow_release_conditions}}</p>
  <p><strong>Payment Terms</strong>: {{payment_terms}}</p>
  <p><strong>Buyer Signature</strong>: <span class="sign-line"></span> Printed Name: <span class="sign-line">{{buyer_signatory_name}}</span> Title: <span class="sign-line">{{buyer_signatory_title}}</span> Date: <span class="sign-line"></span> Entity: <span class="sign-line">{{buyer_entity_name}}</span></p>
  <p><strong>Seller Signature</strong>: <span class="sign-line"></span> Printed Name: <span class="sign-line">{{seller_signatory_name}}</span> Title: <span class="sign-line">{{seller_signatory_title}}</span> Date: <span class="sign-line"></span> Entity: <span class="sign-line">{{seller_entity_name}}</span></p>`;
  return pageShell({ title, body });
};
