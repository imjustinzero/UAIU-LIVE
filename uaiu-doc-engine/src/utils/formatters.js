function asCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(amount || 0));
}

function asDate(value) {
  const date = new Date(value);
  return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}/${date.getUTCFullYear()}`;
}

function asQuantity(value) {
  return Number(value || 0).toLocaleString('en-US');
}

module.exports = { asCurrency, asDate, asQuantity };
