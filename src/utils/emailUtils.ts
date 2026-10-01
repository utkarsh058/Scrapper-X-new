/**
 * Email Utilities: Normalizes and extracts email addresses.
 * Never guesses or fabricates email addresses.
 */
export function normalizeEmail(rawEmail?: string | null): string | undefined {
  if (!rawEmail || typeof rawEmail !== 'string') return undefined;
  const trimmed = rawEmail.trim().toLowerCase();
  if (
    !trimmed ||
    trimmed === 'not available' ||
    trimmed === 'none' ||
    trimmed.includes('example.com') ||
    trimmed.includes('yourname@') ||
    trimmed.includes('name@domain.com')
  ) {
    return undefined;
  }

  // Simple email pattern check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailRegex.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

export function extractEmailsFromText(text: string): string[] {
  if (!text) return [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  const valid = matches
    .map((e) => normalizeEmail(e))
    .filter((e): e is string => Boolean(e));
  return Array.from(new Set(valid));
}
