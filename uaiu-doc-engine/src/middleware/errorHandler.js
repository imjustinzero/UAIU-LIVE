module.exports = function errorHandler(err, _req, res, _next) {
  const statusCode = Number(err?.statusCode) || 500;

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
