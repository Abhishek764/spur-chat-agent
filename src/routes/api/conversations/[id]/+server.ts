import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;
	if (!id) {
		return json({ error: 'Conversation id is required.' }, { status: 400 });
	}

	try {
		const conversation = await prisma.conversation.findUnique({
			where: { id },
			include: {
				messages: {
					orderBy: { createdAt: 'asc' },
					select: { id: true, sender: true, text: true, createdAt: true }
				}
			}
		});

		if (!conversation) {
			return json({ error: 'Conversation not found.' }, { status: 404 });
		}

		return json({ sessionId: conversation.id, messages: conversation.messages });
	} catch (err) {
		console.error('[api/conversations] Unexpected error:', err);
		return json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
	}
};
