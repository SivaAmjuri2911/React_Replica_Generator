const CODE_FENCE_PATTERN = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;

/**
 * Best-effort recovery for models that don't reliably honor
 * `response_format: json_schema` — some OpenRouter-routed models (especially
 * cheaper/faster variants) wrap their JSON in a markdown code fence, or add
 * stray prose before/after it, despite being asked for a bare JSON object.
 * Returns the original text unchanged if neither pattern is found, so a
 * genuinely non-JSON response still fails JSON.parse with an honest error
 * rather than being silently mangled.
 */
export function extractJsonPayload(rawContent: string): string {
  const trimmed = rawContent.trim();

  const fenceMatch = CODE_FENCE_PATTERN.exec(trimmed);
  if (fenceMatch?.[1] !== undefined) {
    return fenceMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}
