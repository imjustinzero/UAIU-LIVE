const express = require('express');

const router = express.Router();

router.all('*', (_req, res) => {
  res.status(501).json({
    error: {
      name: 'NotImplemented',
      message: 'Endpoint will be added in a follow-up phase.',
      statusCode: 501,
      isOperational: true,
    },
  });
});

module.exports = router;
