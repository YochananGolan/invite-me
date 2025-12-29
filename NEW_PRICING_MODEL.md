# New Pricing Model - Pay As You Grow

## Overview

The pricing model has been simplified to a **free tier with pay-as-you-grow addons**:

- ✅ **Free Tier**: Up to 50 guests - completely free
- 💰 **Addon Packages**: 100 guests for 100₪ each

## How It Works

### 1. Starting a New Event
- Users automatically get **free tier** (50 guests)
- No plan selection required
- Just start creating their event immediately

### 2. Adding Guests
- Users can invite up to 50 guests for free
- When they exceed 50 guests, a popup appears

### 3. Capacity Exceeded Popup
When guests exceed the current capacity, users see:

```
🎉 מספר האורחים עולה על המכסה!
יש לך X אורחים מוזמנים

Current Capacity: 50 → Your Guests: X
נדרשים עוד Y מקומות

💰 הצעה מיוחדת
₪100
עבור 100 אורחים נוספים

מספר חבילות נדרשות: N
סה"כ לתשלום: ₪X
```

### 4. Purchase Flow
1. System calculates how many addon packages needed
2. User clicks "רכוש N חבילות (₪X)"
3. Tranzila payment modal opens
4. After successful payment, capacity is immediately increased
5. User can continue adding guests

### 5. Multiple Purchases
Users can purchase multiple addon packages:
- 51-150 guests = 1 addon (₪100)
- 151-250 guests = 2 addons (₪200)
- 251-350 guests = 3 addons (₪300)
- And so on...

## Pricing Formula

```javascript
Free Limit: 50 guests
Addon Capacity: 100 guests per addon
Price per Addon: ₪100

Total Capacity = 50 + (Number of Addons × 100)
Total Cost = Number of Addons × ₪100
```

## Example Scenarios

### Scenario 1: Small Event (30 guests)
- **Capacity Needed**: 30
- **Cost**: FREE ✅
- **Addons Purchased**: 0

### Scenario 2: Medium Event (120 guests)
- **Capacity Needed**: 120
- **Base Free**: 50
- **Additional Needed**: 70 guests
- **Addons Required**: 1 (provides 100)
- **Cost**: ₪100

### Scenario 3: Large Event (280 guests)
- **Capacity Needed**: 280
- **Base Free**: 50
- **Additional Needed**: 230 guests
- **Addons Required**: 3 (provides 300)
- **Cost**: ₪300

### Scenario 4: Very Large Event (500 guests)
- **Capacity Needed**: 500
- **Base Free**: 50
- **Additional Needed**: 450 guests
- **Addons Required**: 5 (provides 500)
- **Cost**: ₪500

## Technical Implementation

### State Management

```javascript
// Everyone starts with free tier
selectedPlan: 'free' (automatically set)

// Addon packages stored as array
additionalPackages: ['addon', 'addon', 'addon'] // 3 addons = 300 extra guests

// Capacity calculation
const freeLimit = 50;
const addonCount = additionalPackages.filter(p => p === 'addon').length;
const totalCapacity = freeLimit + (addonCount * 100);
```

### Payment Flow

```javascript
// When capacity exceeded
handlePurchaseAddon() {
  // Calculate packages needed
  const packagesNeeded = Math.ceil(guestsNeeded / 100);
  const totalCost = packagesNeeded * 100;

  // Open payment modal
  setPaymentAmount(totalCost);
  setPaymentPlanName(`${packagesNeeded} חבילות הרחבה`);
  setShowPaymentModal(true);
}

// After successful payment
handlePaymentSuccess() {
  // Add purchased addons
  const newAddons = Array(pendingAddonCount).fill('addon');
  setAdditionalPackages(prev => [...prev, ...newAddons]);
}
```

## Benefits of New Model

### For Users
1. **No Upfront Payment** - Start completely free
2. **Pay Only What You Need** - Buy capacity as you grow
3. **Transparent Pricing** - Simple ₪100 per 100 guests
4. **Flexible** - Buy more addons anytime
5. **No Waste** - Don't pay for unused capacity

### For Business
1. **Lower Barrier to Entry** - More users will start free
2. **Higher Conversion** - Users already invested before paying
3. **Scalable Revenue** - Earn based on actual usage
4. **Simpler to Explain** - One price, easy to understand
5. **Better User Experience** - No complex tier selection

## User Journey

```
1. User Signs Up (FREE)
   ↓
2. Creates New Event (FREE - auto set to free tier)
   ↓
3. Adds Event Details (FREE)
   ↓
4. Selects Design (FREE)
   ↓
5. Adds Guests
   - Up to 50 guests: FREE ✅
   - 51+ guests: Payment popup appears
   ↓
6. Capacity Warning Shows
   "You have 75 guests, need 1 addon package"
   ↓
7. User Clicks "Purchase 1 Package (₪100)"
   ↓
8. Tranzila Payment Modal Opens
   ↓
9. Payment Successful
   ↓
10. Capacity Increased to 150
    ↓
11. Can Continue Adding Guests
```

## Migration Notes

### Old Model (Removed)
- ❌ Required plan selection before event creation
- ❌ Multiple tier options (א, ב, ג, ד, ה, ו)
- ❌ Fixed capacity ranges per tier
- ❌ Different prices for each tier
- ❌ Complex addon system for each tier

### New Model (Current)
- ✅ Free tier by default
- ✅ Single addon option (100 guests for ₪100)
- ✅ Flexible capacity (buy as many as needed)
- ✅ Simple, transparent pricing
- ✅ Pay-as-you-grow model

## Code Changes Summary

### Modified Files
- `components/StepButtons.js`:
  - Removed plan selection requirement
  - Simplified to free + addons model
  - Updated capacity calculations
  - New addon purchase popup
  - Updated payment handlers

### Key Functions Changed
- `handleCreateNewEvent()` - Now auto-sets free tier
- `handlePurchaseAddon()` - Calculates and purchases needed addons
- `handlePaymentSuccess()` - Adds multiple addon packages
- `getPlanBaseLimit()` - Simplified to free (50) and addon (100)
- Capacity warning modal - Completely redesigned

### Removed/Disabled
- Old pricing tier selection modal (6 tiers)
- `handleSelectPlan()` - No longer needed
- `handleAddPackagePlan()` - Replaced with addon purchase
- Complex tier pricing logic

## Testing Checklist

- [ ] Create new event - should auto-set to free tier
- [ ] Add 40 guests - should work without payment
- [ ] Add 51st guest - should show capacity warning
- [ ] Purchase 1 addon - should cost ₪100
- [ ] Payment successful - capacity should increase to 150
- [ ] Add 140 guests - should show warning for 1 more addon
- [ ] Purchase 2 addons - should cost ₪200
- [ ] Total capacity should be 350 (50 + 100 + 100 + 100)
- [ ] Try to exceed 350 - should offer more addons

## Future Enhancements

Potential improvements:
1. **Bulk Discounts** - 5+ addons get 10% off
2. **Annual Plans** - Unlimited events with X capacity
3. **Referral Rewards** - Get free addon for referrals
4. **Usage Analytics** - Show users their capacity usage
5. **Auto-purchase** - Option to auto-buy when needed
