/**
 * Domain knowledge for the fictional store the agent supports. Kept as structured
 * data (rather than a hand-written prompt blob) so it is easy to read, edit, and
 * later move into the database without touching the prompt-building code.
 */

export interface StoreProfile {
	name: string;
	tagline: string;
}

export interface FaqEntry {
	topic: string;
	answer: string;
}

export const store: StoreProfile = {
	name: 'Nimbus Goods',
	tagline: 'everyday home and lifestyle products'
};

export const faqs: FaqEntry[] = [
	{
		topic: 'Shipping',
		answer:
			'We ship across India and to the USA, UK, Canada, and Australia. Domestic orders arrive in 3–5 business days; international orders take 7–14 business days. Shipping is free on domestic orders above ₹999.'
	},
	{
		topic: 'Returns & refunds',
		answer:
			'Unused items can be returned within 30 days of delivery for a full refund. Once we receive the item, refunds are processed to the original payment method within 5–7 business days. Sale items are final and cannot be returned.'
	},
	{
		topic: 'Order tracking',
		answer:
			'A tracking link is emailed as soon as an order ships. Customers can also find it under "My Orders" on their account page.'
	},
	{
		topic: 'Support hours',
		answer:
			'Our support team is available Monday to Friday, 9am–6pm IST. Messages outside these hours are answered the next business day.'
	},
	{
		topic: 'Payments',
		answer:
			'We accept UPI, all major credit and debit cards, net banking, and popular wallets. International orders are billed in USD.'
	}
];

/** Render the knowledge base into a compact block for the system instruction. */
export function renderKnowledge(): string {
	const lines = faqs.map((faq) => `- ${faq.topic}: ${faq.answer}`);
	return [`Store: ${store.name} (${store.tagline}).`, '', 'Policies and FAQs:', ...lines].join(
		'\n'
	);
}
