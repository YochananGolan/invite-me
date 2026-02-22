# Tranzila Payment Integration Setup Guide

This guide will help you set up Tranzila payment processing for your event management system.

## Prerequisites

- A Tranzila merchant account (terminal)
- Access to Tranzila's administration panel (my.tranzila.com)
- Your Tranzila terminal name
- Your deployed application URL (for callback URLs)

## Step 1: Environment Variables

Add the following to your `.env.local` file:

```bash
# Tranzila Configuration
NEXT_PUBLIC_TRANZILA_TERMINAL=your_terminal_name_here
TRANZILA_TERMINAL=your_terminal_name_here
TRANZILA_TERMINAL_PASSWORD=your_terminal_password_here

# Optional legacy alias supported by the API route.
#TRANZILA_PW=your_terminal_password_here

# Your existing Tranzila API key (if using direct API)
# TRANZILLA_API_KEY is already configured in your .env.local
```

**Important:** Replace `your_terminal_name_here` with your actual Tranzila terminal name.
`TRANZILA_TERMINAL_PASSWORD` is provided by Tranzila support and is required for handshake
requests. Store it only on the server side (never expose it to the browser).

> 💡 **Development fallback:** When these variables are not defined and the app runs in development
> mode, the `/api/tranzila/handshake` route automatically returns a mock response that uses Tranzila's
> public test terminal (`jira`). This keeps the user flow working without performing real payments.
> Configure the real terminal name and password to disable the mock mode and enable live transactions.

## Step 2: Database Setup

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Run the SQL script in `supabase-transactions-table.sql`

This will create:
- `transactions` table to store payment records
- Indexes for performance
- Row Level Security (RLS) policies
- Necessary triggers

## Step 3: Configure Tranzila Terminal Settings

Log in to https://my.tranzila.com and configure the following:

### Iframe Settings

1. Go to **Settings** → **Terminal** → **Iframe Settings**
2. Enable iframe integration
3. Configure the following URLs:

```
Success URL: https://your-domain.com/api/tranzila/success
Failure URL: https://your-domain.com/api/tranzila/failure
Notify URL: https://your-domain.com/api/tranzila/notify
```

Replace `your-domain.com` with your actual deployed domain.

### Vercel Production

**Important:** Set these environment variables in Vercel Dashboard → Settings → Environment Variables:

- `NEXT_PUBLIC_TRANZILA_TERMINAL` = your terminal name (e.g. testgya)
- `TRANZILA_TERMINAL_PASSWORD` = Terminal Token Password (TranzilaPW) from my.tranzila.com
- `NEXT_PUBLIC_APP_URL` = https://your-domain.vercel.app (for callback URLs)

Without these, payments will fail with 400 in production.

### Payment Options (Optional)

Enable additional payment methods:
- ✓ Bit Pay (if needed)
- ✓ Google Pay (if needed)
- ✓ Apple Pay (if needed)

### Display Settings (Optional)

Customize the payment form:
- Background color
- Button color
- Text color
- Logo display

## Step 4: Testing

### Test Mode

For testing, you can use Tranzila's test terminal:
- Test terminal: `jira`
- Test URL: `https://direct.tranzila.com/jira/iframenew.php`

### Test Card Numbers

Tranzila provides test card numbers for development. Contact Tranzila support for test credentials.

### Testing the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the event creation flow
3. Select a paid plan (מסלול ב, מסלול ג, etc.)
4. The payment modal should open with the Tranzila iframe
5. Complete a test transaction

## Step 5: Production Deployment

Before going live:

1. **Update Environment Variables:**
   - Set production Tranzila terminal name
   - Verify all URLs are using HTTPS

2. **Configure Production Callbacks:**
   - Update Success URL
   - Update Failure URL
   - Update Notify URL
   - All URLs must use HTTPS in production

3. **Test Callbacks:**
   - Make a small test transaction
   - Verify success callback is triggered
   - Verify transaction is saved to database
   - Check notify callback receives data

4. **Security Checks:**
   - Verify RLS policies are enabled on transactions table
   - Ensure API keys are in `.env.local` (not committed to git)
   - Test that users can only see their own transactions

## Payment Flow Overview

```
User selects paid plan
      ↓
Payment modal opens with Tranzila iframe
      ↓
User enters card details in Tranzila's secure form
      ↓
Tranzila processes payment
      ↓
      ├─→ Success: Redirect to /api/tranzila/success
      │   - Display success message
      │   - Activate plan for user
      │   - Close modal
      │
      └─→ Failure: Redirect to /api/tranzila/failure
          - Display error message
          - Allow retry
          - Don't activate plan

Notify callback (parallel):
  - Tranzila sends transaction data to /api/tranzila/notify
  - Save transaction to database
  - Send confirmation email (optional)
```

## Pricing Configuration

Current plan pricing (configured in `components/StepButtons.js`):

| Plan | Guests | Price |
|------|--------|-------|
| מסלול א (Free) | Up to 50 | Free |
| מסלול ב (Standard) | 51-200 | 149 ₪ |
| מסלול ג (Premium) | 201-350 | 199 ₪ |
| מסלול ד (Luxury) | 351-500 | 259 ₪ |
| מסלול ה (Elite) | 501-650 | 349 ₪ |
| מסלול ו (Supreme) | 651-1000 | 499 ₪ |

To update prices, edit the `getPlanPrice()` function in `components/StepButtons.js`.

## Troubleshooting

### Payment modal doesn't open
- Check browser console for errors
- Verify `NEXT_PUBLIC_TRANZILA_TERMINAL` is set correctly
- Check that TranzilaPayment component is imported

### Iframe doesn't load
- Verify terminal name is correct
- Check browser network tab for 404 errors
- Ensure URL format is correct: `https://direct.tranzila.com/{terminal}/iframenew.php`

### Success callback not working
- Verify success URL is accessible (test in browser)
- Check API route is deployed
- Look for errors in server logs
- Ensure URL is configured in Tranzila dashboard

### Transactions not saving to database
- Check Supabase logs for errors
- Verify RLS policies allow inserts
- Ensure transactions table exists
- Check notify API route logs

### Payment succeeds but plan not activated
- Check `handlePaymentSuccess` function
- Verify localStorage is working
- Check browser console for errors
- Ensure success callback sends proper data

## Security Best Practices

1. **Never expose secret keys:**
   - Keep API keys in `.env.local`
   - Don't commit `.env.local` to git
   - Use environment variables in production

2. **Validate transactions:**
   - Always verify transaction data in notify callback
   - Check response codes (000 = success)
   - Validate amounts match expected values

3. **Use HTTPS:**
   - All callback URLs must use HTTPS in production
   - Tranzila requires secure connections

4. **Implement RLS:**
   - Enable Row Level Security on transactions table
   - Users should only access their own transactions
   - Use service role for system operations

5. **Log everything:**
   - Log all transaction attempts
   - Log callback responses
   - Monitor for unusual patterns

## Support

- **Tranzila Support:** https://www.tranzila.com/support
- **Tranzila Documentation:** See `tranzila-iframe-integration.md` and `tranzila-authentication.md`
- **Supabase Support:** https://supabase.com/docs

## Files Created

- `components/TranzilaPayment.js` - Payment modal component
- `pages/api/tranzila/success.js` - Success callback handler
- `pages/api/tranzila/failure.js` - Failure callback handler
- `pages/api/tranzila/notify.js` - Server-to-server notification handler
- `supabase-transactions-table.sql` - Database schema
- `tranzila-iframe-integration.md` - Complete API documentation
- `tranzila-authentication.md` - Authentication guide
- `TRANZILA_SETUP.md` - This setup guide

## Next Steps

After successful setup:

1. **Test thoroughly** with real transactions (small amounts)
2. **Monitor transactions** in Supabase dashboard
3. **Set up email notifications** for successful payments
4. **Add receipt generation** (optional)
5. **Implement refund handling** (if needed)
6. **Add transaction history** page for users

## Additional Features (Optional)

Consider implementing:
- Transaction receipt emails
- Invoice generation PDF
- Refund processing
- Recurring payments for subscriptions
- Payment retry logic
- Transaction export to Excel
- Payment analytics dashboard
