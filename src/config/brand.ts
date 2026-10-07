export const GP_AUTOS_WHATSAPP_NUMBER = '2348168606202';

export function buildWhatsAppUrl(message: string): string {
	return `https://wa.me/${GP_AUTOS_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
