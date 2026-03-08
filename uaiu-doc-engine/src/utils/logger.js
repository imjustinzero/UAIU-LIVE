function format(level, payload) {
  const event = typeof payload === 'string' ? { message: payload } : payload || {};
  return JSON.stringify({ level, timestamp: new Date().toISOString(), ...event });
}

module.exports = {
  info(payload) {
    process.stdout.write(`${format('info', payload)}\n`);
  },
  warn(payload) {
    process.stdout.write(`${format('warn', payload)}\n`);
  },
  error(payload) {
    process.stderr.write(`${format('error', payload)}\n`);
  },
};
