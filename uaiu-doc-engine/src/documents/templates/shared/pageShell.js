const styles = require('./uaiuStyles');

function pageShell({ title, body }) {
  return `<!doctype html><html><head><meta charset="utf-8"/>${styles}</head><body>${title}${body}<div class="footer">UAIU Holdings Corp | UAIU.LIVE/X</div></body></html>`;
}

module.exports = pageShell;
