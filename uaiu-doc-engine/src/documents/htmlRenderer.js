function renderHtml(html) {
  if (typeof html !== 'string' || !html.startsWith('<')) {
    throw new Error('Invalid HTML payload');
  }
  return html;
}

module.exports = { renderHtml };
