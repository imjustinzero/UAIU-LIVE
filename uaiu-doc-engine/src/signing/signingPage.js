function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function getSigningPageHTML(signatureRequest, trade, pdfUrl) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>UAIU Signing</title>
  <style>
    body { font-family: Arial, sans-serif; background:#f4f6fb; margin:0; color:#0b1f45; }
    .wrap{max-width:1100px;margin:0 auto;padding:24px}
    .card{background:#fff;border-radius:10px;padding:20px;box-shadow:0 6px 20px rgba(0,0,0,.08);margin-bottom:18px}
    .brand{font-weight:700;color:#0b1f45}.gold{color:#c89a28}.title{font-size:24px;margin:8px 0 14px}
    iframe{border:1px solid #d6dce8;border-radius:8px}
    .panel{background:#f8fafc;border:1px solid #d6dce8;border-radius:8px;padding:14px}
    .consent{border:2px solid #c89a28;background:#fffaf0}
    .row{margin:8px 0}.btn{padding:12px 18px;border-radius:7px;border:none;font-weight:700;cursor:pointer}
    .btn-sign{background:#0b1f45;color:#fff}.btn-sign:disabled{opacity:.5;cursor:not-allowed}
    .btn-decline{background:#fff;color:#9d1c1c;border:1px solid #c64b4b}
    input[type=text]{width:100%;padding:10px;border:1px solid #cdd6e5;border-radius:6px}
    .footer{text-align:center;color:#5b6472;font-size:12px;padding:12px}
  </style></head><body>
  <div class="wrap">
    <div class="card">
      <div class="brand">UAIU Holdings Corp <span class="gold">| UAIU.LIVE/X</span></div>
      <div class="title">Electronic Document Signing</div>
      <div>Trade ID: <strong>${esc(trade.tradeId)}</strong> | Document: <strong>${esc(signatureRequest.document.docType)}</strong> | Signer: <strong>${esc(signatureRequest.signerName)} (${esc(signatureRequest.signerRole)})</strong></div>
    </div>

    <div class="card">
      <iframe src="${esc(pdfUrl)}" width="100%" height="600px"></iframe>
      <p>Please review the complete document above before signing.</p>
    </div>

    <div class="card panel">
      <div><strong>Signing as:</strong> ${esc(signatureRequest.signerName)} (${esc(signatureRequest.signerRole)})</div>
      <div><strong>Document:</strong> ${esc(signatureRequest.document.docType)}</div>
      <div><strong>Trade ID:</strong> ${esc(trade.tradeId)}</div>
      <div><strong>This link expires:</strong> ${new Date(signatureRequest.tokenExpiresAt).toUTCString()}</div>
    </div>

    <div class="card consent">
      <h3>ELECTRONIC SIGNATURE DISCLOSURE AND CONSENT</h3>
      <p>By checking the box and clicking 'I Agree and Sign' below, you agree that:</p>
      <ol>
        <li>You have reviewed the complete document displayed above.</li>
        <li>Your electronic signature is legally binding to the same extent as a handwritten signature under the Electronic Signatures in Global and National Commerce Act (15 U.S.C. § 7001 et seq.) and applicable state law.</li>
        <li>You are authorized to sign on behalf of the entity named in this document.</li>
        <li>Your signature, IP address, timestamp, and browser information will be recorded as part of the official audit record for this transaction.</li>
        <li>You may request a paper copy of this document by contacting UAIU at documents@uaiu.live.</li>
      </ol>
      <form id="signForm" method="post" action="/sign/${esc(signatureRequest.token)}">
        <div class="row"><label><input id="consent" type="checkbox" name="consentGiven" value="true"/> I have read and agree to the Electronic Signature Disclosure above</label></div>
        <div class="row"><label>Type your full legal name to confirm identity</label><input id="fullName" type="text" name="fullName" value="" placeholder="First Last"/></div>
        <input type="hidden" name="action" id="actionField" value="sign"/>
        <div class="row" style="display:flex;gap:10px;align-items:center;">
          <button id="signBtn" class="btn btn-sign" type="submit" disabled>I Agree and Sign</button>
          <button id="declineBtn" class="btn btn-decline" type="button">Decline</button>
          <span id="loader" style="display:none;color:#0b1f45;">Submitting...</span>
        </div>
      </form>
    </div>

    <div class="footer">This signing session is secured by UAIU Holdings Corp. Questions? Contact documents@uaiu.live<br/>UAIU Holdings Corp, Wyoming C-Corporation</div>
  </div>

  <script>
    const consent = document.getElementById('consent');
    const fullName = document.getElementById('fullName');
    const signBtn = document.getElementById('signBtn');
    const declineBtn = document.getElementById('declineBtn');
    const actionField = document.getElementById('actionField');
    const signForm = document.getElementById('signForm');
    const loader = document.getElementById('loader');
    const expectedName = ${JSON.stringify(String(signatureRequest.signerName || ''))};

    function validName(name){
      const trimmed = name.trim();
      return trimmed.split(/\s+/).length >= 2;
    }

    function refresh(){
      signBtn.disabled = !(consent.checked && validName(fullName.value));
    }

    consent.addEventListener('change', refresh);
    fullName.addEventListener('input', refresh);

    signForm.addEventListener('submit', function(e){
      if(actionField.value === 'sign'){
        if(!validName(fullName.value)){ e.preventDefault(); alert('Please enter your full legal name (first and last).'); return; }
        if(expectedName && fullName.value.trim().toLowerCase() !== expectedName.trim().toLowerCase()){
          e.preventDefault(); alert('The entered name must match the name on record for this signing link.'); return;
        }
        if(!consent.checked){ e.preventDefault(); alert('You must provide consent before signing.'); return; }
      }
      signBtn.disabled = true; declineBtn.disabled = true; loader.style.display = 'inline';
    });

    declineBtn.addEventListener('click', function(){
      if(!confirm('Are you sure you want to decline this signature request?')) return;
      actionField.value = 'decline';
      signForm.submit();
    });
  </script>
  </body></html>`;
}

module.exports = { getSigningPageHTML };
