const Anthropic = require('@anthropic-ai/sdk');

const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = {
  anthropicClient,
  model: 'claude-sonnet-4-20250514',
};
