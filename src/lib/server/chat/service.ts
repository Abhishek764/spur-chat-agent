import { prisma } from '$lib/server/db';
import { generateReply, LlmError, type ConversationTurn } from '$lib/server/llm/gemini';
import { truncateMessage } from '$lib/server/validation';

export interface ChatInput {
	message: string;
	sessionId?: string;
}

export interface ChatResult {
	reply: string;
	sessionId: string;
	/** True when the reply is a fallback because the model call failed. */
	degraded: boolean;
}

const FALLBACK_REPLY =
	"Sorry, I'm having trouble answering right now. Please try again in a moment.";

/**
 * Core chat flow: resolve the conversation, persist the user's message, ask the
 * model for a reply using prior history, and persist the reply. The user message
 * is saved before the model call so it is never lost, even if generation fails.
 */
export async function handleChat({ message, sessionId }: ChatInput): Promise<ChatResult> {
	const text = truncateMessage(message);
	const conversation = await resolveConversation(sessionId);

	const history = await loadHistory(conversation.id);

	await prisma.message.create({
		data: { conversationId: conversation.id, sender: 'user', text }
	});

	let reply: string;
	let degraded = false;
	try {
		reply = await generateReply(history, text);
		await prisma.message.create({
			data: { conversationId: conversation.id, sender: 'ai', text: reply }
		});
	} catch (err) {
		logLlmError(err);
		reply = FALLBACK_REPLY;
		degraded = true;
	}

	return { reply, sessionId: conversation.id, degraded };
}

/** Look up an existing conversation by id, or start a new one. */
async function resolveConversation(sessionId?: string) {
	if (sessionId) {
		const existing = await prisma.conversation.findUnique({ where: { id: sessionId } });
		if (existing) {
			return existing;
		}
	}
	return prisma.conversation.create({ data: {} });
}

async function loadHistory(conversationId: string): Promise<ConversationTurn[]> {
	const messages = await prisma.message.findMany({
		where: { conversationId },
		orderBy: { createdAt: 'asc' },
		select: { sender: true, text: true }
	});
	return messages.map((m) => ({ sender: m.sender, text: m.text }));
}

function logLlmError(err: unknown) {
	if (err instanceof LlmError) {
		console.error(`[chat] LLM failure (${err.kind}): ${err.message}`);
	} else {
		console.error('[chat] Unexpected error while generating reply:', err);
	}
}
