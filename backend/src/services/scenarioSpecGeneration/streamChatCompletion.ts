
import type OpenAI from 'openai';
import type { Logger } from '../../logging/Logger.js';

/** Derived from the SDK's own method signature rather than a named import, so this stays correct even if the SDK renames its internal param type. */
type ChatCompletionCreateParams = Parameters<OpenAI['chat']['completions']['create']>[0];

export interface StreamedChatCompletionResult {
  readonly content: string;
  readonly refusal: string;
  readonly finishReason: string | undefined;
  /** The max_completion_tokens value actually used for the request that produced this result — not necessarily what the caller originally asked for, see wasReducedForAffordability. */
  readonly maxCompletionTokensUsed: number | undefined;
  /** True when the original request was rejected as unaffordable and this result comes from the automatic reduced-budget retry. */
  readonly wasReducedForAffordability: boolean;
}

/** Matches OpenRouter's (and possibly other OpenAI-compatible providers') 402 wording: "...but can only afford 39577". */
const AFFORDABLE_TOKEN_LIMIT_PATTERN = /can only afford (\d+)/i;

/**
 * Streams a chat completion and accumulates it into one result, instead of
 * a single non-streaming call. Non-streaming requests to an OpenAI-shaped
 * API risk client/SDK HTTP timeouts at high `max_tokens` — the same reason
 * ClaudeScenarioSpecGenerationService streams — so this is the shared path
 * for both OpenAiScenarioSpecGenerationService and
 * OpenRouterScenarioSpecGenerationService, which otherwise only differ in
 * which base URL/key they hand the SDK.
 *
 * Also retries once, automatically, if the provider rejects the request
 * because the account can't afford the requested `max_completion_tokens` —
 * its error message says exactly how many tokens it CAN afford, so a low-
 * balance account doesn't have to fail outright when a smaller budget would
 * likely still be enough for the actual response.
 */
export async function streamChatCompletion(
  client: OpenAI,
  params: Omit<ChatCompletionCreateParams, 'stream'>,
  logger?: Logger
): Promise<StreamedChatCompletionResult> {
  try {
    return await streamOnce(client, params, false);
  } catch (cause) {
    const affordableTokenLimit = extractAffordableTokenLimit(cause);
    if (affordableTokenLimit === undefined) {
      throw cause;
    }

    const requestedTokens = typeof params.max_completion_tokens === 'number' ? params.max_completion_tokens : undefined;
    const reducedMaxTokens =
      requestedTokens !== undefined ? Math.min(affordableTokenLimit, requestedTokens) : affordableTokenLimit;

    logger?.warn('Account cannot afford the requested output budget — retrying once with a reduced max_completion_tokens', {
      requestedTokens,
      reducedMaxTokens,
    });

    return await streamOnce(client, { ...params, max_completion_tokens: reducedMaxTokens }, true);
  }
}

async function streamOnce(
  client: OpenAI,
  params: Omit<ChatCompletionCreateParams, 'stream'>,
  wasReducedForAffordability: boolean
): Promise<StreamedChatCompletionResult> {
  const stream = await client.chat.completions.create({ ...params, stream: true });

  let content = '';
  let refusal = '';
  let finishReason: string | undefined;

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    if (!choice) {
      continue;
    }
    if (choice.delta.content) {
      content += choice.delta.content;
    }
    if (choice.delta.refusal) {
      refusal += choice.delta.refusal;
    }
    if (choice.finish_reason) {
      finishReason = choice.finish_reason;
    }
  }

  const maxCompletionTokensUsed = typeof params.max_completion_tokens === 'number' ? params.max_completion_tokens : undefined;
  return { content, refusal, finishReason, maxCompletionTokensUsed, wasReducedForAffordability };
}

function extractAffordableTokenLimit(cause: unknown): number | undefined {
  const message = cause instanceof Error ? cause.message : String(cause);
  const match = AFFORDABLE_TOKEN_LIMIT_PATTERN.exec(message);
  return match?.[1] ? Number(match[1]) : undefined;
}
