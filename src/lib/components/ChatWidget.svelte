<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Message from './Message.svelte';
	import TypingIndicator from './TypingIndicator.svelte';
	import { sendMessage, fetchHistory } from '$lib/api';
	import type { ChatMessage } from '$lib/types';

	const STORAGE_KEY = 'spur_chat_session';
	const SUGGESTIONS = [
		'What is your return policy?',
		'Do you ship to the USA?',
		'What are your support hours?'
	];

	let messages = $state<ChatMessage[]>([]);
	let draft = $state('');
	let sending = $state(false);
	let sessionId = $state<string | undefined>(undefined);
	let listEl = $state<HTMLDivElement | null>(null);

	const canSend = $derived(draft.trim().length > 0 && !sending);

	onMount(async () => {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (!saved) return;
		sessionId = saved;
		try {
			messages = await fetchHistory(saved);
			scrollToBottom();
		} catch {
			// Ignore history load failures — the user can still start chatting.
		}
	});

	async function scrollToBottom() {
		await tick();
		listEl?.scrollTo({ top: listEl.scrollHeight, behavior: 'smooth' });
	}

	function addMessage(sender: ChatMessage['sender'], text: string) {
		messages = [...messages, { id: crypto.randomUUID(), sender, text }];
	}

	async function submit() {
		const text = draft.trim();
		if (!text || sending) return;

		draft = '';
		addMessage('user', text);
		sending = true;
		scrollToBottom();

		try {
			const res = await sendMessage(text, sessionId);
			sessionId = res.sessionId;
			localStorage.setItem(STORAGE_KEY, res.sessionId);
			addMessage('ai', res.reply);
		} catch {
			addMessage('ai', 'Sorry, something went wrong. Please try again.');
		} finally {
			sending = false;
			scrollToBottom();
		}
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			submit();
		}
	}

	function useSuggestion(text: string) {
		draft = text;
		submit();
	}
</script>

<section class="chat">
	<header class="header">
		<div class="avatar" aria-hidden="true">N</div>
		<div>
			<p class="title">Nimbus Goods Support</p>
			<p class="subtitle">Ask about shipping, returns, and more</p>
		</div>
	</header>

	<div class="messages" bind:this={listEl}>
		{#if messages.length === 0}
			<div class="empty">
				<p>Hi! How can I help you today?</p>
				<div class="suggestions">
					{#each SUGGESTIONS as suggestion (suggestion)}
						<button type="button" onclick={() => useSuggestion(suggestion)} disabled={sending}>
							{suggestion}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#each messages as message (message.id)}
			<Message sender={message.sender} text={message.text} />
		{/each}

		{#if sending}
			<TypingIndicator />
		{/if}
	</div>

	<form
		class="composer"
		onsubmit={(event) => {
			event.preventDefault();
			submit();
		}}
	>
		<textarea
			bind:value={draft}
			onkeydown={onKeydown}
			placeholder="Type your message…"
			rows="1"
			maxlength="20000"
			aria-label="Message"
		></textarea>
		<button type="submit" disabled={!canSend} aria-label="Send">Send</button>
	</form>
</section>

<style>
	.chat {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 30rem;
		height: min(80vh, 40rem);
		background: #fff;
		border: 1px solid #e6e6ea;
		border-radius: 1rem;
		overflow: hidden;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
	}

	.header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.9rem 1rem;
		background: #4f46e5;
		color: #fff;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		font-weight: 600;
	}
	.title {
		margin: 0;
		font-weight: 600;
	}
	.subtitle {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.85;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		background: #fafafb;
	}

	.empty {
		margin: auto 0;
		text-align: center;
		color: #555;
	}
	.empty p {
		margin: 0 0 0.75rem;
	}
	.suggestions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.suggestions button {
		padding: 0.55rem 0.75rem;
		border: 1px solid #d8d8df;
		border-radius: 0.75rem;
		background: #fff;
		color: #333;
		cursor: pointer;
		font-size: 0.9rem;
	}
	.suggestions button:hover:not(:disabled) {
		border-color: #4f46e5;
		color: #4f46e5;
	}

	.composer {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem;
		border-top: 1px solid #e6e6ea;
		background: #fff;
	}
	textarea {
		flex: 1;
		resize: none;
		border: 1px solid #d8d8df;
		border-radius: 0.75rem;
		padding: 0.6rem 0.75rem;
		font: inherit;
		max-height: 8rem;
	}
	textarea:focus {
		outline: 2px solid #c7c4f5;
		border-color: #4f46e5;
	}
	.composer button {
		align-self: flex-end;
		padding: 0.6rem 1.1rem;
		border: none;
		border-radius: 0.75rem;
		background: #4f46e5;
		color: #fff;
		font-weight: 600;
		cursor: pointer;
	}
	.composer button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
