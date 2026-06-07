import type { ChatMessage } from './types';

export interface ChatResponse {
	reply: string;
	sessionId: string;
}

/** Send a message to the agent. Throws with the server's error text on failure. */
export async function sendMessage(message: string, sessionId?: string): Promise<ChatResponse> {
	const res = await fetch('/api/chat', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ message, sessionId })
	});

	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(data.error ?? 'Request failed.');
	}
	return data as ChatResponse;
}

/** Load prior messages for a session. Returns an empty list if it no longer exists. */
export async function fetchHistory(sessionId: string): Promise<ChatMessage[]> {
	const res = await fetch(`/api/conversations/${sessionId}`);
	if (res.status === 404) {
		return [];
	}
	if (!res.ok) {
		throw new Error('Failed to load conversation history.');
	}
	const data = await res.json().catch(() => ({}));
	return (data.messages ?? []) as ChatMessage[];
}
