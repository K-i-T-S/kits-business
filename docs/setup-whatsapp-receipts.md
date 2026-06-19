# Setup Guide — WhatsApp Receipts

> **Status:** Edge function deployed. Waiting for Meta Business credentials.
> **Plan required:** Business ($79/mo)
> **Time to complete:** ~30 minutes

WhatsApp penetration in Lebanon is ~100%. This feature lets your staff send a formatted sale receipt directly to any customer's WhatsApp number in one tap from the POS receipt screen.

---

## How It Works

1. Cashier completes a sale → receipt modal opens
2. If the customer has a phone number saved and the tenant is on Business plan, a green **Send via WhatsApp** button appears
3. Tapping it calls the `whatsapp-receipt` Supabase Edge Function
4. The function calls the Meta WhatsApp Business Cloud API and sends a formatted text message to the customer's number
5. Customer receives the receipt on WhatsApp within seconds

---

## Prerequisites

- KiTS Business plan (Business tier — $79/mo)
- A Meta (Facebook) Business account
- Customer records must have a phone number in E.164 format: `+961XXXXXXXX`

---

## Step-by-Step Setup

### Step 1 — Meta Developer Account

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Log in with your Facebook/Meta account
3. Click **My Apps** → **Create App**
4. Choose app type: **Business**
5. App name: `KiTS Business` (or your business name)
6. Select your Meta Business portfolio (create one if needed at [business.facebook.com](https://business.facebook.com))

---

### Step 2 — Add WhatsApp Product

1. Inside your new app dashboard, click **Add Product**
2. Find **WhatsApp** → click **Set Up**
3. You land on **WhatsApp → Getting Started**

---

### Step 3 — Get Your Credentials

On the WhatsApp **Getting Started** page, you'll see:

| Credential | Location | Example |
|---|---|---|
| **Temporary access token** | "Access Token" section at the top | `EAABwzLixnjYBO...` |
| **Phone Number ID** | Below the token, labelled "Phone number ID" | `123456789012345` |

> The temporary token expires in **24 hours**. Use it first to test, then follow Step 6 to get a permanent token for production.

---

### Step 4 — Add Your Test Phone Number

On the same Getting Started page:
1. Under **Send and receive messages**, find the **To** dropdown
2. Click **Manage phone number list**
3. Click **Add phone number**
4. Enter your number in E.164: `+96181290662`
5. Meta will send a verification code to that WhatsApp — enter it to confirm

> Meta requires you to opt-in numbers before they can receive test messages.

---

### Step 5 — Set Supabase Secrets

Once you have your token and phone number ID, run this command (replace the values):

```bash
supabase secrets set \
  WHATSAPP_TOKEN="EAABwzLixnjYBO..." \
  WHATSAPP_PHONE_ID="123456789012345" \
  --project-ref pytndxjeznhhyycjasep
```

Or paste both values in the KiTS chat and the assistant will run it for you.

---

### Step 6 — Test It

1. Log in to KiTS → go to **POS**
2. Add a customer who has a phone number
3. Complete a sale
4. On the receipt, click the green **Send via WhatsApp** button
5. The customer's WhatsApp should receive a message within ~5 seconds

**Sample message format:**
```
🧾 *Receipt from [Business Name]*
Sale #A1B2C3

📦 *Items:*
• Product Name — 2 × $5.00
• Another Product — 1 × $12.00

💰 *Subtotal:* $22.00
🏷️ *TVA 11%:* $2.42
✅ *Total:* $24.42

💳 *Payment:* Cash

Thank you for your purchase! 🙏
```

---

### Step 7 — Production: Permanent Token

The temporary token expires in 24h. For production:

1. In your Meta App, go to **Business Settings** → **System Users**
2. Create a new **System User** (role: Employee or Admin)
3. Click **Add Assets** → select your WhatsApp Business Account → grant `Full Control`
4. Click **Generate New Token** → select your app → check `whatsapp_business_messaging` permission
5. Copy the token (it doesn't expire)
6. Update the secret:

```bash
supabase secrets set WHATSAPP_TOKEN="your_permanent_token" --project-ref pytndxjeznhhyycjasep
```

---

## Customer Segment Setup

For the WhatsApp button to appear on a receipt, the customer record must have a valid phone number. When adding customers in KiTS:

- Use E.164 format: `+961 X XXX XXX` (Lebanon) or `+971 XX XXX XXXX` (UAE)
- The system uses the `phone` field from the `customers` table
- No separate WhatsApp field is needed — Meta routes to WhatsApp automatically for Lebanese numbers

---

## Troubleshooting

| Issue | Likely Cause | Fix |
|---|---|---|
| Button doesn't appear | Customer has no phone, or plan < Business | Add phone to customer record; check plan |
| "Failed to send" toast | WHATSAPP_TOKEN or WHATSAPP_PHONE_ID not set | Run `supabase secrets set` command above |
| Recipient doesn't receive message | Number not on Meta test list | Add number via Getting Started → Manage list |
| Token expired | Using temporary token | Follow Step 6 to get permanent token |
| 400 error in logs | Phone number format wrong | Ensure E.164: `+96170123456` (no spaces) |

---

## Architecture Notes

**Edge Function:** `supabase/functions/whatsapp-receipt/index.ts`
- Called from `src/pages/POS.tsx` → `handleSendWhatsApp()`
- Meta Cloud API v18.0 endpoint: `https://graph.facebook.com/v18.0/{PHONE_ID}/messages`
- Auth: Bearer token from `WHATSAPP_TOKEN` env var
- Message type: `text` (plain, pre-formatted with emojis)
- Returns `{ success: true, messageId }` or `{ error: "..." }` with HTTP status

**Plan gate:** `hasFeature('enterprise_dashboard')` in `SubscriptionContext`

**Future:** Upgrade to `template` message type for improved deliverability outside the 24h session window (requires Meta template approval).

---

## Future Enhancements

- [ ] Low-stock alert to owner WhatsApp (scheduled Edge Function)
- [ ] Daily sales summary to owner WhatsApp (pg_cron trigger)
- [ ] WhatsApp template messages (approved templates, better deliverability)
- [ ] Customer opt-out tracking
