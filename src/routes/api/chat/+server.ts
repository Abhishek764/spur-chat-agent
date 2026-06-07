import { json, type RequestHandler } from '@sveltejs/kit';
import { chatRequestSchema } from '$lib/server/validation';
import { handleChat } from '$lib/server/chat/service';

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}

	const parsed = chatRequestSchema.safeParse(body);
	if (!parsed.success) {
		const message = parsed.error.issues[0]?.message ?? 'Invalid request.';
		return json({ error: message }, { status: 400 });
	}

	try {
		const result = await handleChat(parsed.data);
		return json({ reply: result.reply, sessionId: result.sessionId });
	} catch (err) {
		console.error('[api/chat] Unexpected error:', err);
		return json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
	}
};
