const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b\d{16}\b/, // Credit card
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i, // Email
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/, // Phone
  /\bpassword\s*[:=]\s*\S+/i, // Inline passwords
  /sk-[a-zA-Z0-9]{32,}/, // OpenAI keys
  /sk-ant-[a-zA-Z0-9-]{32,}/, // Anthropic keys
  /AIza[0-9A-Za-z-_]{35}/, // Google keys
];

export function scanForPII(text: string): { hasPII: boolean; matches: string[] } {
  const matches = PII_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
  return { hasPII: matches.length > 0, matches };
}
