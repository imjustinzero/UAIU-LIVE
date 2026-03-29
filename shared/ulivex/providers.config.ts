export const PROVIDERS = {
  anthropic: {
    chat: 'claude-sonnet-4-5',
    apiVersion: '2023-06-01',
    maxTokens: 8096,
    streamingSupported: true,
  },
  openai: {
    chat: 'gpt-4o',
    embedding: 'text-embedding-3-small',
    maxTokens: 4096,
    streamingSupported: true,
  },
  google: {
    chat: 'gemini-1.5-pro-latest',
    maxTokens: 8192,
    streamingSupported: true,
  },
  together: {
    chat: 'ulivex-core-v1',
    baseModel: 'meta-llama/Llama-3-70b-chat-hf',
    maxTokens: 4096,
    streamingSupported: true,
  },
  pinecone: {
    indexName: 'ulivex-memory',
    dimensions: 1536,
    metric: 'cosine',
    environment: 'us-east-1-aws',
  },
} as const;

export const PROVIDER_CHANGE_LOG = [] as const;
