# Stripe Setup Guide for FieldSnaps

This guide walks you through setting up Stripe billing for FieldSnaps. Follow these steps to enable subscription payments and webhooks.

## Prerequisites

- A Stripe account (sign up at [stripe.com](https://stripe.com))
- Access to your Replit project's Secrets management
- Admin access to configure webhook endpoints

## Step 1: Create Stripe Product & Price

1. **Log in to Stripe Dashboard**
   - Go to [dashboard.stripe.com](https://dashboard.stripe.com)
   - Make sure you're in **Test mode** (toggle in top-right) for initial setup

2. **Create a Product**
   - Navigate to **Products** in the left sidebar
   - Click **+ Add product**
   - Fill in product details:
     - **Name**: `FieldSnaps Pro`
     - **Description**: `Full access to FieldSnaps construction photo management`
     - **Pricing model**: Select "Standard pricing"
     - **Price**: `19.99` USD
     - **Billing period**: Select "Monthly"
     - **Price description**: `Monthly subscription`
   - Click **Add product**

3. **Copy the Price ID**
   - After creating the product, you'll see a **Price ID** (starts with `price_`)
   - Copy this ID - you'll need it for the `STRIPE_PRICE_ID` secret
   - Example: `price_1ABC123XYZ456DEF789`

## Step 2: Get Stripe API Keys

1. **Navigate to API Keys**
   - In Stripe Dashboard, go to **Developers** → **API keys**

2. **Copy Secret Key**
   - Under "Standard keys", find **Secret key**
   - Click **Reveal test key** (or live key when ready for production)
   - Copy the key (starts with `sk_test_` for test mode or `sk_live_` for production)
   - ⚠️ **Security Warning**: Never commit this key to your codebase!

3. **Copy Publishable Key**
   - Also copy the **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - This is used on the frontend (already configured in the app)

## Step 3: Configure Webhook Endpoint

1. **Navigate to Webhooks**
   - In Stripe Dashboard, go to **Developers** → **Webhooks**
   - Click **+ Add endpoint**

2. **Enter Endpoint URL**
   - **Endpoint URL**: Enter your Replit deployment URL + `/api/webhooks/stripe`
   - Examples:
     - Development: `http://localhost:5000/api/webhooks/stripe` (local testing only)
     - Production: `https://your-repl-name.replit.app/api/webhooks/stripe`
     - Custom domain: `https://fieldsnaps.com/api/webhooks/stripe`

3. **Select Events to Listen For**
   - Click **Select events**
   - Search and select these 4 events:
     - ✅ `checkout.session.completed`
     - ✅ `invoice.payment_succeeded`
     - ✅ `invoice.payment_failed`
     - ✅ `customer.subscription.deleted`
   - Click **Add events**

4. **Add the Endpoint**
   - Click **Add endpoint** to save

5. **Copy Webhook Signing Secret**
   - After creating the endpoint, click on it to view details
   - Find **Signing secret** section
   - Click **Reveal** to show the secret (starts with `whsec_`)
   - Copy this secret - you'll need it for `STRIPE_WEBHOOK_SECRET`

## Step 4: Add Secrets to Replit

1. **Open Replit Secrets Manager**
   - In your Replit project, go to **Tools** → **Secrets**
   - Or use the padlock icon 🔒 in the left sidebar

2. **Add the Following Secrets**

   Add each secret with the exact name and value:

   | Secret Name | Value | Example |
   |-------------|-------|---------|
   | `STRIPE_SECRET_KEY` | Your Stripe secret key from Step 2 | `sk_test_51A...` |
   | `STRIPE_PRICE_ID` | Your price ID from Step 1 | `price_1A...` |
   | `STRIPE_WEBHOOK_SECRET` | Your webhook signing secret from Step 3 | `whsec_A...` |
   | `VITE_STRIPE_PUBLIC_KEY` | Your publishable key from Step 2 | `pk_test_51A...` |

3. **Verify All Secrets Are Set**
   - Make sure all 4 secrets are properly configured
   - The app checks for these on startup

## Step 5: Test the Integration

### Test Checkout Flow

1. **Start Your Application**
   - Make sure your Replit is running
   - Navigate to the app URL

2. **Trigger Checkout**
   - Create an account or log in
   - Go to **Settings**
   - Click **Upgrade to Pro**
   - You should be redirected to Stripe Checkout

3. **Use Test Card**
   - Card number: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)

4. **Complete Payment**
   - After successful payment, you should be redirected to `/billing/success`
   - Check Settings - your subscription status should be "Active"

### Test Webhook Delivery

1. **Check Webhook Logs in Stripe**
   - Go to **Developers** → **Webhooks** → Click your endpoint
   - View the **Attempts** tab to see recent webhook deliveries
   - Successful webhooks show ✅ with 200 status
   - Failed webhooks show ❌ with error details

2. **Check Application Logs**
   - In Replit, check the console output
   - Look for `[Webhook]` log messages
   - Should see: `[Webhook] Checkout completed for user <userId>`

### Test Failed Payment (Optional)

1. **Use Declined Test Card**
   - Card number: `4000 0000 0000 0341` (card declined)
   - Go through checkout with this card
   - Check that proper error handling occurs

2. **Simulate Payment Failure**
   - In Stripe Dashboard, go to **Billing** → **Subscriptions**
   - Find a test subscription
   - Click **⋯** → **Update payment** → Use declined card
   - Check that:
     - User's `subscriptionStatus` changes to `past_due`
     - `pastDueSince` timestamp is set
     - Payment notification banner appears in app

## Step 6: Enable Customer Portal (Optional)

The Customer Portal allows users to manage their subscriptions, update payment methods, and view invoices.

1. **Activate Customer Portal**
   - Go to **Settings** → **Customer portal**
   - Click **Activate test link** (or "Activate" for production)

2. **Configure Portal Settings**
   - **Business information**: Add company name and support email
   - **Products**: Your FieldSnaps Pro product should be listed
   - **Features**: Enable:
     - ✅ Invoice history
     - ✅ Update payment method
     - ✅ Cancel subscription
   - Click **Save**

3. **Test Portal Access**
   - In the app, when subscription is `past_due`, click **Update Payment**
   - Should redirect to Stripe Customer Portal
   - Test updating payment method

## Production Checklist

When ready to go live, complete these steps:

### 1. Switch to Live Mode
- [ ] Toggle Stripe Dashboard from **Test mode** to **Live mode**
- [ ] Create a new **live product** with same pricing ($19.99/month)
- [ ] Get new **live API keys** (`sk_live_...` and `pk_live_...`)
- [ ] Create new **live webhook endpoint** (same events)
- [ ] Get new **live webhook secret** (`whsec_...`)

### 2. Update Replit Secrets
- [ ] Replace `STRIPE_SECRET_KEY` with live secret key
- [ ] Replace `STRIPE_PRICE_ID` with live price ID
- [ ] Replace `STRIPE_WEBHOOK_SECRET` with live webhook secret
- [ ] Replace `VITE_STRIPE_PUBLIC_KEY` with live publishable key

### 3. Verify Production Setup
- [ ] Test checkout with real payment method
- [ ] Verify webhook delivery in live mode
- [ ] Test Customer Portal access
- [ ] Monitor webhook logs for any failures
- [ ] Set up Stripe email notifications for payment failures

### 4. Configure Stripe Settings
- [ ] Set up **email receipts** in Stripe Dashboard → Settings → Emails
- [ ] Configure **failed payment emails** in Billing settings
- [ ] Enable **smart retries** for failed payments
- [ ] Set up **fraud detection** rules if needed

## Troubleshooting

### Webhooks Not Receiving

**Problem**: Webhooks show failed deliveries in Stripe

**Solutions**:
1. Check that your Replit deployment is running
2. Verify webhook URL is correct (must be publicly accessible)
3. Check that `STRIPE_WEBHOOK_SECRET` matches the signing secret in Stripe
4. Review application logs for webhook errors
5. Ensure firewall/security settings allow Stripe IPs

### Checkout Session Fails

**Problem**: Error when clicking "Upgrade to Pro"

**Solutions**:
1. Verify `STRIPE_SECRET_KEY` is set correctly
2. Check that `STRIPE_PRICE_ID` matches your product's price ID
3. Review browser console for JavaScript errors
4. Check that billing service is configured (not in dormant mode)

### Payment Updates Not Working

**Problem**: Customer Portal link doesn't work

**Solutions**:
1. Ensure user has a `stripeCustomerId` in the database
2. Verify Customer Portal is activated in Stripe settings
3. Check that `STRIPE_SECRET_KEY` has proper permissions
4. Review logs for portal session creation errors

## Additional Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing Cards](https://stripe.com/docs/testing)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)

## Support

If you encounter issues during setup:
1. Check the troubleshooting section above
2. Review Stripe webhook logs for delivery errors
3. Check application logs in Replit console
4. Verify all secrets are correctly configured
5. Ensure you're using the correct mode (test vs. live)

---

**Security Reminder**: Never commit Stripe API keys to your repository. Always use Replit's Secrets feature to store sensitive credentials.
