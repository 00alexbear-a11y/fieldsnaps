import type { Company } from "../shared/schema";
import { billingService } from "./billing";

export type SubscriptionSource = "stripe" | "apple" | "google" | "none";

export interface SubscriptionStatus {
  isValid: boolean;
  status: "trial" | "active" | "past_due" | "canceled" | "none";
  source: SubscriptionSource;
  trialEndsAt?: Date;
  expiresAt?: Date;
  message?: string;
}

/**
 * Unified subscription validation service
 * Checks subscription validity from Stripe, Apple IAP, or Google Play
 */
export class SubscriptionValidationService {
  
  /**
   * Validate company subscription from any payment source
   */
  async validateCompanySubscription(company: Company): Promise<SubscriptionStatus> {
    const source = (company.subscriptionSource || "stripe") as SubscriptionSource;

    // Handle trial period
    if (company.subscriptionStatus === "trial") {
      const trialValid = this.isTrialValid(company.trialEndsAt);
      return {
        isValid: trialValid,
        status: "trial",
        source,
        trialEndsAt: company.trialEndsAt || undefined,
        message: trialValid ? "Trial active" : "Trial expired"
      };
    }

    // Route to appropriate validation method based on source
    switch (source) {
      case "stripe":
        return await this.validateStripeSubscription(company);
      
      case "apple":
        return await this.validateAppleSubscription(company);
      
      case "google":
        return await this.validateGoogleSubscription(company);
      
      case "none":
      default:
        return {
          isValid: false,
          status: "none",
          source: "none",
          message: "No active subscription"
        };
    }
  }

  /**
   * Validate Stripe subscription
   */
  private async validateStripeSubscription(company: Company): Promise<SubscriptionStatus> {
    // If no Stripe subscription ID, invalid
    if (!company.stripeSubscriptionId) {
      return {
        isValid: false,
        status: "none",
        source: "stripe",
        message: "No Stripe subscription found"
      };
    }

    // Check current status from company record
    const status = company.subscriptionStatus as SubscriptionStatus["status"];
    
    // Active and past_due are considered valid (past_due has grace period)
    const isValid = status === "active" || status === "past_due";

    return {
      isValid,
      status,
      source: "stripe",
      message: isValid ? "Stripe subscription active" : `Stripe subscription ${status}`
    };
  }

  /**
   * Validate Apple IAP subscription
   * Stub for future StoreKit integration
   */
  private async validateAppleSubscription(company: Company): Promise<SubscriptionStatus> {
    // TODO: Implement Apple receipt verification
    // 1. Send receipt to Apple's verifyReceipt endpoint
    // 2. Check subscription status and expiration
    // 3. Handle receipt refresh if needed
    
    if (!company.platformSubscriptionId) {
      return {
        isValid: false,
        status: "none",
        source: "apple",
        message: "No Apple receipt found"
      };
    }

    // For now, trust the stored subscription status
    // In production, this should verify the receipt with Apple
    const status = company.subscriptionStatus as SubscriptionStatus["status"];
    const isValid = status === "active" || status === "past_due";

    return {
      isValid,
      status,
      source: "apple",
      message: `Apple IAP ${status} (verification pending implementation)`
    };
  }

  /**
   * Validate Google Play subscription
   * Stub for future Play Billing integration
   */
  private async validateGoogleSubscription(company: Company): Promise<SubscriptionStatus> {
    // TODO: Implement Google Play purchase verification
    // 1. Send purchase token to Google Play Developer API
    // 2. Check subscription status and expiration
    // 3. Handle purchase token refresh if needed
    
    if (!company.platformSubscriptionId) {
      return {
        isValid: false,
        status: "none",
        source: "google",
        message: "No Google purchase token found"
      };
    }

    // For now, trust the stored subscription status
    // In production, this should verify with Google Play API
    const status = company.subscriptionStatus as SubscriptionStatus["status"];
    const isValid = status === "active" || status === "past_due";

    return {
      isValid,
      status,
      source: "google",
      message: `Google Play ${status} (verification pending implementation)`
    };
  }

  /**
   * Check if trial period is still valid
   */
  private isTrialValid(trialEndsAt: Date | null | undefined): boolean {
    if (!trialEndsAt) {
      return false;
    }
    return new Date() < new Date(trialEndsAt);
  }

  /**
   * Check if user has multiple active subscriptions (should not happen)
   * Returns true if duplicate detected
   */
  async detectDuplicateSubscriptions(company: Company): Promise<boolean> {
    let activeCount = 0;

    // Check Stripe
    if (company.stripeSubscriptionId && 
        (company.subscriptionStatus === "active" || company.subscriptionStatus === "past_due")) {
      activeCount++;
    }

    // Check Apple (if different source)
    if (company.subscriptionSource === "apple" && company.platformSubscriptionId) {
      activeCount++;
    }

    // Check Google (if different source)
    if (company.subscriptionSource === "google" && company.platformSubscriptionId) {
      activeCount++;
    }

    return activeCount > 1;
  }

  /**
   * Get human-readable subscription info for UI display
   */
  getSubscriptionDisplayInfo(company: Company): {
    provider: string;
    status: string;
    statusColor: "green" | "yellow" | "red" | "gray";
  } {
    const source = company.subscriptionSource || "stripe";
    const status = company.subscriptionStatus || "none";

    const providerNames = {
      stripe: "Stripe",
      apple: "Apple App Store",
      google: "Google Play",
      none: "None"
    };

    const statusColors: Record<string, "green" | "yellow" | "red" | "gray"> = {
      trial: "yellow",
      active: "green",
      past_due: "yellow",
      canceled: "red",
      none: "gray"
    };

    return {
      provider: providerNames[source as SubscriptionSource],
      status: status.charAt(0).toUpperCase() + status.slice(1).replace("_", " "),
      statusColor: statusColors[status] || "gray"
    };
  }
}

export const subscriptionValidationService = new SubscriptionValidationService();
