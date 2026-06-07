import { z } from 'zod';

/** Longest message we accept at all. Anything beyond this is a bad request. */
export const MAX_INPUT_LENGTH = 20_000;

/** Length we truncate a message to before storing it and sending it to the model. */
export const MAX_MESSAGE_LENGTH = 4_000;

export const chatRequestSchema = z.object({
	message: z
		.string({
			required_error: 'message is required',
			invalid_type_error: 'message must be a string'
		})
		.max(MAX_INPUT_LENGTH, 'message is too long')
		.transform((value) => value.trim())
		.refine((value) => value.length > 0, 'message cannot be empty'),
	sessionId: z.string().min(1).optional()
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Cap a message to {@link MAX_MESSAGE_LENGTH} so oversized input still works. */
export function truncateMessage(message: string): string {
	return message.length > MAX_MESSAGE_LENGTH ? message.slice(0, MAX_MESSAGE_LENGTH) : message;
}
