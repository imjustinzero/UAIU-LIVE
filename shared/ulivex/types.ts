export type AIModel = 'claude' | 'openai' | 'gemini' | 'ulivex';
export type MeetingMode = 'debate' | 'consensus' | 'chain' | 'panel' | 'adversarial';
export type MessageRole = 'user' | 'claude' | 'openai' | 'gemini' | 'ulivex' | 'system';

export interface AIResponse {
  model: AIModel;
  content: string;
  tokensUsed: number;
  latencyMs: number;
  confidence?: number;
  error?: string;
  timestamp: number;
}

export interface OrchestratorConfig {
  mode: MeetingMode;
  activeModels: AIModel[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  enableMemory?: boolean;
  sessionId?: string;
}

export interface QualityScore {
  total: number;
  accuracy: number;
  clarity: number;
  completeness: number;
  reasoning: number;
  helpfulness: number;
  comment: string;
}

export interface TrainingDataPoint {
  id: string;
  prompt: string;
  responses: AIResponse[];
  synthesis: string;
  autoScore: number;
  humanScore?: number;
  mode: MeetingMode;
  tags: string[];
  constitutionVersion: string;
  constitutionHash: string;
  modelsUsed: AIModel[];
  piiScanned: boolean;
  evalSet: boolean;
  doNotTrain: boolean;
  createdAt: Date;
  usedInTraining: boolean;
}

export interface OrchestratorResult {
  responses: AIResponse[];
  synthesis: string;
  consensusScore: number;
  topResponse: AIResponse;
  trainingDataPoint: TrainingDataPoint;
  insights: string[];
  totalLatencyMs: number;
}

export interface MemoryEntry {
  id: string;
  content: string;
  source: 'upload' | 'conversation' | 'manual' | 'web';
  title: string;
  category: string;
  tags: string[];
  importance: 1 | 2 | 3;
  pineconeId: string;
  createdAt: Date;
  accessCount: number;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  description: string;
  emoji: string;
  systemPrompt: string;
  preferredModel: AIModel;
  fallbackModel: AIModel;
  temperature: number;
  maxTokens: number;
  memoryCategories: string[];
  enabledTools: string[];
  isPublic: boolean;
  useCount: number;
  createdAt: Date;
}

export interface UserAPIKeys {
  anthropic?: string;
  openai?: string;
  google?: string;
  together?: string;
}

export interface AnalyticsData {
  totalQueries: number;
  queriesByModel: Record<AIModel, number>;
  avgLatency: Record<AIModel, number>;
  avgQuality: Record<AIModel, number>;
  winRate: Record<AIModel, number>;
  tokensConsumed: Record<AIModel, number>;
  trainingDataPoints: number;
  estimatedCostUSD: number;
}

export type StreamEventType =
  | 'ai_start'
  | 'ai_token'
  | 'ai_complete'
  | 'synthesis_start'
  | 'synthesis_token'
  | 'synthesis_complete'
  | 'error'
  | 'done';

export interface StreamEvent {
  type: StreamEventType;
  model?: AIModel;
  content?: string;
  metadata?: Partial<AIResponse>;
  error?: string;
}

export interface FeatureFlag {
  enabled: boolean;
  rolloutPercent: number;
}
