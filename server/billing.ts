import Stripe from "stripe";
import type { User, Subscription, InsertSubscription, InsertSubscriptionEvent } from "../shared/schema";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

export class BillingService {
  private readonly TRIAL_DAYS = 7;
  private readonly MONTHLY_PRICE = 1999; // $19.99 in cents

  async getOrCreateStripeCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
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

  async createTrialSubscription(
    user: User,
    customerId: string,
    priceId: string
  ): Promise<{ subscription: Stripe.Subscription; clientSecret: string | null }> {
    const subscription = await stripe.subscriptions.create({
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
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      return await stripe.subscriptions.cancel(subscriptionId);
    }
  }

  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  async updatePaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Stripe.Customer> {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    return await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice.payment_intent"],
    });
  }

  parseWebhookEvent(body: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      throw new Error("Missing STRIPE_WEBHOOK_SECRET");
    }

    return stripe.webhooks.constructEvent(body, signature, webhookSecret);
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
