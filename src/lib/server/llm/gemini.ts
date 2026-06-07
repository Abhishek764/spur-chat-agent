import { GoogleGenAI, type Content } from '@google/genai';
import { env } from '$env/dynamic/private';
import { buildSystemInstruction } from './prompt';

export type Sender = 'user' | 'ai';

export interface ConversationTurn {
	sender: Sender;
	text: string;
}

export type LlmErrorKind = 'config' | 'timeout' | 'rate_limit' | 'auth' | 'empty' | 'unknown';

/** Error thrown by the LLM layer. The chat service maps these to user-facing copy. */
export class LlmError extends Error {
	constructor(
		readonly kind: LlmErrorKind,
		message: string,
		readonly cause?: unknown
	) {
		super(message);
		this.name = 'LlmError';
	}
}

const MODEL = env.GEMINI_MODEL || 'gemini-2.5-flash';
const TIMEOUT_MS = 15_000;
const MAX_OUTPUT_TOKENS = 1024;
// Cap how much history we replay to the model to keep latency and token cost bounded.
const MAX_HISTORY_TURNS = 20;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
	if (!env.GEMINI_API_KEY) {
		throw new LlmError('config', 'GEMINI_API_KEY is not set.');
	}
	if (!client) {
		client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
	}
	return client;
}

function toContents(history: ConversationTurn[], userMessage: string): Content[] {
	const recent = history.slice(-MAX_HISTORY_TURNS);
	const contents: Content[] = recent.map((turn) => ({
		role: turn.sender === 'ai' ? 'model' : 'user',
		parts: [{ text: turn.text }]
	}));
	contents.push({ role: 'user', parts: [{ text: userMessage }] });
	return contents;
}

/**
 * Generate a support reply for `userMessage` given prior conversation `history`.
 * Throws an {@link LlmError} on any failure so callers can decide how to surface it.
 */
export async function generateReply(
	history: ConversationTurn[],
	userMessage: string
): Promise<string> {
	const ai = getClient();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const response = await ai.models.generateContent({
			model: MODEL,
			contents: toContents(history, userMessage),
			config: {
				systemInstruction: buildSystemInstruction(),
				temperature: 0.3,
				maxOutputTokens: MAX_OUTPUT_TOKENS,
				abortSignal: controller.signal,
				httpOptions: { timeout: TIMEOUT_MS }
			}
		});

		const reply = response.text?.trim();
		if (!reply) {
			throw new LlmError('empty', 'The model returned an empty response.');
		}
		return reply;
	} catch (err) {
		throw classify(err);
	} finally {
		clearTimeout(timer);
	}
}

function classify(err: unknown): LlmError {
	if (err instanceof LlmError) {
		return err;
	}

	const name = err instanceof Error ? err.name : '';
	const message = err instanceof Error ? err.message : String(err);
	const status = typeof (err as { status?: number })?.status === 'number'
		? (err as { status: number }).status
		: undefined;
	const haystack = `${status ?? ''} ${message}`.toLowerCase();

	if (name === 'AbortError' || haystack.includes('aborted') || haystack.includes('timeout')) {
		return new LlmError('timeout', 'The model took too long to respond.', err);
	}
	if (status === 429 || haystack.includes('rate limit') || haystack.includes('quota')) {
		return new LlmError('rate_limit', 'The model is rate limited right now.', err);
	}
	if (status === 401 || status === 403 || haystack.includes('api key') || haystack.includes('permission')) {
		return new LlmError('auth', 'The model rejected the API credentials.', err);
	}
	return new LlmError('unknown', message || 'Unknown LLM error.', err);
}
