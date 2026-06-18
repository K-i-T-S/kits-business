import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'KiTS Business <onboarding@kits.tech>';
const WHATSAPP_SUPPORT = '+961 81 290 662';
const SUPPORT_EMAIL = 'kits.tech.co@gmail.com';

interface RequestBody {
  tenantId: string;
  tenantName: string;
  userEmail: string;
  userName?: string;
}

function buildHtml(tenantName: string, userName?: string): string {
  const greeting = userName ? `Hello ${userName}` : 'Welcome';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to KiTS Business</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #f8fafc; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
    .logo { font-size: 24px; font-weight: 700; color: #818cf8; margin-bottom: 32px; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; }
    h1 { font-size: 28px; font-weight: 700; margin: 0 0 8px; }
    p { color: rgba(248,250,252,0.7); line-height: 1.6; margin: 12px 0; }
    .btn { display: inline-block; margin-top: 24px; padding: 14px 28px; background: linear-gradient(to right, #4f46e5, #0ea5e9); color: #fff; text-decoration: none; border-radius: 12px; font-weight: 600; }
    .footer { margin-top: 32px; font-size: 13px; color: rgba(248,250,252,0.4); }
    .support-link { color: #818cf8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="logo">KiTS Business</div>
    <div class="card">
      <h1>${greeting}!</h1>
      <p>Your business <strong>${tenantName}</strong> is now set up on KiTS Business Terminal — your all-in-one POS and business management platform built for Lebanese and MENA businesses.</p>
      <p>Here's what you can do right now:</p>
      <ul style="color:rgba(248,250,252,0.7);line-height:1.8;">
        <li>Add your products and set prices</li>
        <li>Process your first sale at the POS</li>
        <li>Add customers and track purchases</li>
        <li>View your sales reports and analytics</li>
      </ul>
      <a class="btn" href="https://business.kits.tech/dashboard">Open your dashboard →</a>
    </div>
    <div class="footer">
      <p>Need help? Contact us on WhatsApp: <a class="support-link" href="https://wa.me/${WHATSAPP_SUPPORT.replace(/\s+/g, '')}">${WHATSAPP_SUPPORT}</a> or email <a class="support-link" href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      <p>You are receiving this because you signed up for KiTS Business Terminal.</p>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();
    const { tenantName, userEmail, userName } = body;

    if (!userEmail || !tenantName) {
      return new Response(JSON.stringify({ success: false, error: 'userEmail and tenantName are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [userEmail],
        subject: `Welcome to KiTS Business — ${tenantName} is ready`,
        html: buildHtml(tenantName, userName),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return new Response(JSON.stringify({ success: false, error: errorBody }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
