<div class="row" aria-live="polite" aria-label="Agent is typing">
	<div class="bubble">
		<span class="dot"></span>
		<span class="dot"></span>
		<span class="dot"></span>
	</div>
</div>

<style>
	.row {
		display: flex;
		justify-content: flex-start;
	}
	.bubble {
		display: inline-flex;
		gap: 0.25rem;
		align-items: center;
		padding: 0.7rem 0.85rem;
		background: #f1f1f4;
		border-radius: 1rem;
		border-bottom-left-radius: 0.25rem;
	}
	.dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: #9a9aa5;
		animation: blink 1.2s infinite ease-in-out;
	}
	.dot:nth-child(2) {
		animation-delay: 0.2s;
	}
	.dot:nth-child(3) {
		animation-delay: 0.4s;
	}
	@keyframes blink {
		0%,
		80%,
		100% {
			opacity: 0.3;
		}
		40% {
			opacity: 1;
		}
	}
</style>
