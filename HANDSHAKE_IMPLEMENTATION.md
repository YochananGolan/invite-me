# Tranzila Handshake Implementation

## Overview

The handshake feature has been successfully implemented in your payment flow. This provides **fraud prevention** by locking in transaction amounts before the customer sees the checkout page.

## What Was Implemented

### 1. API Route: `/pages/api/tranzila/handshake.js`

- Calls Tranzila's handshake API to create a secure token
- Validates the amount before creating handshake
- Returns `thtk` (handshake token) for use in payment form
- Includes error handling for failed handshakes

### 2. Updated Component: `components/TranzilaPayment.js`

**Changes:**
- Automatically requests handshake token when modal opens
- Only shows payment iframe after handshake succeeds
- Passes `thtk` and `new_process=1` to Tranzila iframe
- Shows loading state: "מאבטח את פרטי התשלום..." during handshake
- Displays error UI if handshake fails
- Includes detailed console logging for debugging

**Flow:**
1. User selects paid plan → Modal opens
2. Component calls `/api/tranzila/handshake` with amount
3. Handshake token received from Tranzila
4. Form submits to iframe with token
5. Tranzila validates amount matches handshake
6. Payment proceeds if valid

## Required Configuration

### Environment Variables

Add this to your `.env.local` file:

```bash
# Tranzila Handshake Configuration
TRANZILA_TERMINAL_PASSWORD=your_terminal_password_here
```

**How to get your Terminal Password:**
1. Log in to https://my.tranzila.com
2. Go to Settings → API Settings
3. Find "Terminal Token Password" or "TranzilaPW"
4. Copy and paste into `.env.local`

**Current Configuration:**
- ✅ `NEXT_PUBLIC_TRANZILA_TERMINAL=testgya` (already set)
- ❌ `TRANZILA_TERMINAL_PASSWORD=???` (MUST BE ADDED)

### Enable Handshake in Tranzila Dashboard

**IMPORTANT:** Before handshake will work, you MUST enable it in your Tranzila account:

1. Log in to https://my.tranzila.com
2. Navigate to: **Settings** → **Terminal** → **Merchant Checkout Page Setup**
3. Click on **"Information Security"**
4. Enable/check the **"HandShake"** field
5. Click **Save**

⚠️ **WARNING:** Once HandShake is enabled, ALL payments will require a handshake token. You cannot process payments without it.

## Testing the Implementation

### 1. Add Terminal Password

```bash
# Edit .env.local
TRANZILA_TERMINAL_PASSWORD=your_actual_password
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Test Payment Flow

1. Open http://localhost:3000
2. Select a paid plan (מסלול ב, ג, etc.)
3. Payment modal should open
4. Watch browser console for debug messages:
   - `🤝 Requesting handshake for amount: XXX`
   - `✅ Handshake successful. Token: ...`
   - `🚀 Auto-submitting payment form with handshake token`
5. Payment form should load in iframe

### 4. Verify Handshake

Open browser console and check for:
- ✅ No errors in console
- ✅ Handshake request succeeds
- ✅ Token received (40-80 characters)
- ✅ Iframe loads without "Illegal Operation 912791" error

## How It Works

### Security Flow

```
1. User selects plan
   ↓
2. Modal opens
   ↓
3. Frontend calls /api/tranzila/handshake
   ↓
4. Backend calls Tranzila API:
   GET https://api.tranzila.com/v1/handshake/create?
       supplier=testgya&
       sum=149&
       TranzilaPW=your_password
   ↓
5. Tranzila returns: thtk=abc123xyz...
   ↓
6. Form submits to iframe with:
   - sum=149
   - thtk=abc123xyz...
   - new_process=1
   ↓
7. Tranzila verifies:
   - Does thtk exist?
   - Does sum match handshake amount?
   - Is token still valid (< 20 min)?
   ↓
8. If valid: Process payment
   If invalid: Error "Illegal Operation 912791"
```

### Fraud Prevention

**What it prevents:**
- ✅ Amount tampering (user can't modify price in browser)
- ✅ Replay attacks (each token is single-use)
- ✅ Session hijacking (tokens expire after 20 minutes)
- ✅ Man-in-the-middle attacks (server-side validation)

**Example attack prevented:**
```javascript
// User opens DevTools and tries to change amount
document.querySelector('[name="sum"]').value = "1"; // Try to pay 1₪ instead of 149₪

// Result: Tranzila rejects because handshake was for 149₪
// Error: "Illegal Operation 912791"
```

## Troubleshooting

### Error: "Missing Tranzila credentials"

**Problem:** `.env.local` is missing `TRANZILA_TERMINAL_PASSWORD`

**Solution:**
```bash
# Add to .env.local
TRANZILA_TERMINAL_PASSWORD=your_password_here
```

### Error: "Handshake failed"

**Possible causes:**
1. Terminal password is incorrect
2. Terminal name is incorrect
3. Handshake not enabled in MY TRANZILA
4. Network/API issue

**Debug steps:**
1. Check console for detailed error message
2. Verify credentials in `.env.local`
3. Test credentials with direct API call:
   ```bash
   curl "https://api.tranzila.com/v1/handshake/create?supplier=testgya&sum=1&TranzilaPW=YOUR_PASSWORD"
   ```

### Error: "Illegal Operation 912791"

**Problem:** Amount mismatch between handshake and iframe

**Causes:**
- Handshake was for amount X but iframe shows amount Y
- Token expired (> 20 minutes)
- Token already used

**Solution:**
- Close and reopen payment modal (generates new handshake)
- Check that amount doesn't change between handshake and form submit

### Handshake succeeds but iframe doesn't load

**Check:**
1. Is `new_process=1` being sent? (Check form in DevTools)
2. Is `thtk` parameter present? (Check form in DevTools)
3. Check browser console for errors

## Files Modified

- ✅ `pages/api/tranzila/handshake.js` (NEW)
- ✅ `components/TranzilaPayment.js` (UPDATED)

## Next Steps

1. **Add terminal password** to `.env.local`
2. **Enable handshake** in MY TRANZILA dashboard
3. **Test** with real transaction (small amount)
4. **Monitor logs** for any issues
5. **Remove debug console.logs** before production (optional)

## Console Debug Messages

When working correctly, you should see:

```
🎨 TranzilaPayment rendering. isOpen: true amount: 149
🔄 TranzilaPayment effect running. isOpen: true
🤝 Requesting handshake for amount: 149
✅ Handshake successful. Token: abcd1234efgh5678...
🚀 Auto-submitting payment form with handshake token
```

## Production Checklist

Before going live:

- [ ] Add `TRANZILA_TERMINAL_PASSWORD` to production environment variables
- [ ] Enable HandShake in MY TRANZILA production terminal
- [ ] Test with real terminal (not `testgya`)
- [ ] Update `NEXT_PUBLIC_TRANZILA_TERMINAL` to production terminal name
- [ ] Test complete payment flow with real card
- [ ] Verify handshake works on production URLs
- [ ] Monitor Tranzila dashboard for successful transactions
- [ ] (Optional) Remove debug console.logs

## Support

If you encounter issues:

1. **Check browser console** for error messages
2. **Check server logs** (terminal running `npm run dev`)
3. **Review Tranzila documentation:** `tranzila-iframe-integration.md`
4. **Contact Tranzila support:** https://www.tranzila.com/support

## Additional Resources

- `tranzila-iframe-integration.md` - Complete iframe documentation
- `tranzila-authentication.md` - API authentication guide
- `TRANZILA_SETUP.md` - General setup guide
- Tranzila Support: https://www.tranzila.com
