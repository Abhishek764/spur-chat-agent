import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_ID = 'demo-conversation';

async function main() {
	await prisma.conversation.upsert({
		where: { id: DEMO_ID },
		update: {},
		create: {
			id: DEMO_ID,
			messages: {
				create: [
					{ sender: 'user', text: 'Hi, what are your support hours?' },
					{
						sender: 'ai',
						text: 'Our support team is available Monday to Friday, 9am–6pm IST. How can I help you today?'
					}
				]
			}
		}
	});

	console.log(`Seeded demo conversation: ${DEMO_ID}`);
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
