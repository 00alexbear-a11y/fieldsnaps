import Stripe from "stripe";
import type { User, Subscription, InsertSubscription, InsertSubscriptionEvent } from "../shared/schema";

export class BillingService {
  private readonly TRIAL_DAYS = 7;
  private readonly MONTHLY_PRICE = 1999; // $19.99 in cents
  private _stripe: Stripe | null = null;

  /**
   * Lazy-load Stripe client to prevent server crash when keys are missing
   * This allows the server to boot without Stripe configured (billing dormant mode)
   */
  private get stripe(): Stripe {
    if (!this._stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("Billing service not configured: Missing STRIPE_SECRET_KEY");
      }
      this._stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2025-09-30.clover",
      });
    }
    return this._stripe;
  }

  /**
   * Check if billing service is properly configured
   * Requires all Stripe credentials to be production-ready
   */
  isConfigured(): boolean {
    return !!(
      process.env.STRIPE_SECRET_KEY && 
      process.env.STRIPE_PRICE_ID && 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  }

  async getOrCreateStripeCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripe.customers.create({
      email: user.email || undefined,
      name: user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.firstName || user.email || undefined,
      metadata: {
        userId: user.id,
      },
    });

    return customer.id;
  }

  async createCheckoutSession(userId: string, successUrl: string, cancelUrl: string): Promise<Stripe.Checkout.Session> {
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      throw new Error("Billing not configured: Missing STRIPE_PRICE_ID");
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
      },
    });

    return session;
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session;
  }

  async createTrialSubscription(
    user: User,
    customerId: string,
    priceId: string
  ): Promise<{ subscription: Stripe.Subscription; clientSecret: string | null }> {
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: this.TRIAL_DAYS,
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
    });

    const latestInvoice = subscription.latest_invoice;
    let clientSecret: string | null = null;
    
    if (latestInvoice && typeof latestInvoice === 'object' && 'payment_intent' in latestInvoice) {
      const pi = latestInvoice.payment_intent;
      if (pi && typeof pi === 'object' && 'client_secret' in pi) {
        clientSecret = (pi as any).client_secret || null;
      }
    }

    return { subscription, clientSecret };
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<Stripe.Subscription> {
    if (cancelAtPeriodEnd) {
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    }
  }

  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  async updatePaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Stripe.Customer> {
    await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    return await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice.payment_intent"],
    });
  }

  parseWebhookEvent(body: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      throw new Error("Billing webhook not configured: Missing STRIPE_WEBHOOK_SECRET");
    }

    return this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
  }

  createSubscriptionEventData(
    subscriptionId: string,
    event: Stripe.Event
  ): InsertSubscriptionEvent {
    const subscription = event.data.object as Stripe.Subscription;
    const invoice = event.type.startsWith("invoice.") ? (event.data.object as Stripe.Invoice) : null;

    return {
      subscriptionId,
      eventType: event.type,
      stripeEventId: event.id,
      status: subscription?.status || null,
      periodStart: subscription && 'current_period_start' in subscription && typeof subscription.current_period_start === 'number'
        ? new Date(subscription.current_period_start * 1000) 
        : null,
      periodEnd: subscription && 'current_period_end' in subscription && typeof subscription.current_period_end === 'number'
        ? new Date(subscription.current_period_end * 1000) 
        : null,
      amountPaid: invoice?.amount_paid || null,
      metadata: event.data.object as any,
    };
  }

  mapStripeStatusToUserStatus(stripeStatus: string): string {
    const statusMap: Record<string, string> = {
      trialing: "trial",
      active: "active",
      past_due: "past_due",
      canceled: "canceled",
      unpaid: "canceled",
      incomplete: "trial",
      incomplete_expired: "none",
    };

    return statusMap[stripeStatus] || "none";
  }
}

export const billingService = new BillingService();
