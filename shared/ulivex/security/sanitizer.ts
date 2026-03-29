const INJECTION_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /you are now/i,
  /system prompt/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
];

export function sanitizePrompt(input: string): string {
  const withoutTags = input.replace(/<[^>]+>/g, '');
  const trimmed = withoutTags.trim().slice(0, 4000);

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new Error('PROMPT_INJECTION_DETECTED');
    }
  }

  return trimmed;
}

export function validateUpload(file: Pick<File, 'type' | 'size'>): void {
  const allowedMime = [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const maxSizeBytes = 20 * 1024 * 1024;

  if (!allowedMime.includes(file.type)) {
    throw new Error(`File type ${file.type} not permitted`);
  }

  if (file.size > maxSizeBytes) {
    throw new Error('File exceeds 20MB limit');
  }
}
