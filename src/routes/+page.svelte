<script lang="ts">
	import ChatWidget from '$lib/components/ChatWidget.svelte';

	const title = 'Nimbus Goods — Support Chat';
	const description =
		'Chat with the Nimbus Goods support agent for instant answers about shipping, returns, payments, and order tracking.';
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta name="robots" content="index, follow" />
	<meta name="theme-color" content="#4f46e5" />
	<link rel="canonical" href="/" />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Nimbus Goods" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content="/favicon.svg" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content="/favicon.svg" />
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
