<script lang="ts">
	import type { Sender } from '$lib/types';

	let { sender, text }: { sender: Sender; text: string } = $props();
</script>

<div class="row" class:user={sender === 'user'}>
	<div class="bubble" class:user={sender === 'user'}>{text}</div>
</div>

<style>
	.row {
		display: flex;
		justify-content: flex-start;
	}
	.row.user {
		justify-content: flex-end;
	}
	.bubble {
		max-width: 80%;
		padding: 0.6rem 0.85rem;
		border-radius: 1rem;
		line-height: 1.45;
		white-space: pre-wrap;
		word-break: break-word;
		background: #f1f1f4;
		color: #1a1a1a;
		border-bottom-left-radius: 0.25rem;
	}
	.bubble.user {
		background: #4f46e5;
		color: #fff;
		border-bottom-left-radius: 1rem;
		border-bottom-right-radius: 0.25rem;
	}
</style>
