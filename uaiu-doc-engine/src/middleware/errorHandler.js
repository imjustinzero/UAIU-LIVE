const logger = require('../utils/logger');

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  logger.error({
    event: 'api_error',
    name: err.name,
    message: err.message,
    statusCode,
    isOperational: Boolean(err.isOperational),
  });

  if (typeof err.toJSON === 'function') {
    return res.status(statusCode).json(err.toJSON());
  }

  return res.status(statusCode).json({
    error: {
      name: err.name || 'InternalServerError',
      message: err.message || 'An unexpected error occurred',
      statusCode,
      isOperational: false,
    },
  });
}

module.exports = errorHandler;
