<script lang="ts">
	import ChatWidget from '$lib/components/ChatWidget.svelte';
</script>

<svelte:head>
	<title>Nimbus Goods — Support Chat</title>
</svelte:head>

<main>
	<ChatWidget />
</main>

<style>
	main {
		display: grid;
		place-items: center;
		min-height: 100vh;
		padding: 1.5rem;
	}
</style>
