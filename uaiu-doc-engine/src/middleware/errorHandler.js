const logger = require('../utils/logger');

module.exports = function errorHandler(err, req, res, _next) {
  const statusCode = Number(err?.statusCode) || 500;

  logger.error({
    event: 'request_failed',
    method: req.method,
    path: req.originalUrl,
    statusCode,
    name: err?.name,
    message: err?.message,
  });

  if (typeof err?.toJSON === 'function') {
    return res.status(statusCode).json(err.toJSON());
  }

  return res.status(statusCode).json({
    error: {
      name: err?.name || 'InternalServerError',
      message: err?.message || 'Unexpected server error',
      statusCode,
      isOperational: Boolean(err?.isOperational),
    },
  });
};
