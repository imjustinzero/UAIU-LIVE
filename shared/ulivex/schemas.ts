import { z } from 'zod';

export const OrchestrateRequestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  models: z.array(z.enum(['claude', 'openai', 'gemini'])).min(1).max(3),
  mode: z.enum(['debate', 'consensus', 'chain', 'panel', 'adversarial']),
  sessionId: z.string().uuid(),
  enableMemory: z.boolean().default(false),
  apiKeys: z
    .object({
      anthropic: z.string().optional(),
      openai: z.string().optional(),
      google: z.string().optional(),
    })
    .optional(),
});

export const SynthesizeRequestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  responses: z
    .array(
      z.object({
        model: z.enum(['claude', 'openai', 'gemini']),
        content: z.string(),
        latencyMs: z.number(),
        tokensUsed: z.number(),
      }),
    )
    .min(1)
    .max(3),
  mode: z.enum(['debate', 'consensus', 'chain', 'panel', 'adversarial']),
  sessionId: z.string().uuid(),
});

export const EmbedRequestSchema = z.object({
  content: z.string().min(50).max(100000),
  title: z.string().max(200),
  source: z.enum(['upload', 'conversation', 'manual', 'web']),
  category: z.string().max(50),
  tags: z.array(z.string()).max(10).default([]),
  importance: z.number().int().min(1).max(3).default(2),
});
