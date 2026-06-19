import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface ReceiptPayload {
  to: string; // E.164 format: +96170123456
  customerName: string;
  saleId: string;
  items: Array<{ name: string; qty: number; price: number }>;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  businessName: string;
  currency?: string; // default USD
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN');
  const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID');

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    return new Response(JSON.stringify({ error: 'WhatsApp not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload: ReceiptPayload = await req.json();
  const currency = payload.currency ?? 'USD';
  const symbol = currency === 'USD' ? '$' : currency;

  // Build text message body
  const itemLines = payload.items
    .map(i => `  ${i.qty}x ${i.name} — ${symbol}${(i.price * i.qty).toFixed(2)}`)
    .join('\n');

  const body = [
    `🧾 *Receipt from ${payload.businessName}*`,
    `Order #${payload.saleId.slice(-8).toUpperCase()}`,
    '',
    itemLines,
    '',
    `Subtotal: ${symbol}${payload.subtotal.toFixed(2)}`,
    payload.tax > 0 ? `TVA 11%: ${symbol}${payload.tax.toFixed(2)}` : null,
    `*Total: ${symbol}${payload.total.toFixed(2)}*`,
    `Payment: ${payload.paymentMethod}`,
    '',
    `Thank you, ${payload.customerName}! 🙏`,
    'Powered by KiTS Business',
  ].filter(Boolean).join('\n');

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: payload.to.replace(/\s/g, ''),
        type: 'text',
        text: { body },
      }),
    },
  );

  const result: unknown = await response.json();

  if (!response.ok) {
    return new Response(JSON.stringify({ error: result }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const msg = result as { messages?: Array<{ id: string }> };

  return new Response(
    JSON.stringify({ success: true, messageId: msg.messages?.[0]?.id }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
