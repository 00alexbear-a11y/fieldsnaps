/**
 * Email Service - Future Integration with Resend
 * 
 * Status: Dormant - Will be activated during production launch
 * Integration: Resend (connector:ccfg_resend_01K69QKYK789WN202XSE3QS17V)
 * 
 * This service will handle transactional emails for:
 * - Welcome emails (new user registration)
 * - Trial reminders (3 days before expiration, 1 day before)
 * - Payment notifications (successful payments, failed payments)
 * - Subscription updates (cancellation confirmations, reactivation)
 * 
 * Setup Instructions (when ready for production):
 * 1. Use search_integrations to find Resend connector
 * 2. Propose setup with use_integration tool
 * 3. User connects Resend account through OAuth/API key
 * 4. Update environment with RESEND_API_KEY
 * 5. Activate email templates below
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private readonly FROM_EMAIL = "FieldSnaps <hello@fieldsnaps.com>";
  
  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(to: string, userName: string): Promise<void> {
    // Template will be activated in production
    const template = this.getWelcomeTemplate(userName);
    console.log(`[EMAIL - DORMANT] Would send welcome email to ${to}`);
    // await this.send(to, template);
  }

  /**
   * Send trial reminder (3 days before expiration)
   */
  async sendTrialReminder3Days(to: string, userName: string, trialEndDate: Date): Promise<void> {
    const template = this.getTrialReminder3DaysTemplate(userName, trialEndDate);
    console.log(`[EMAIL - DORMANT] Would send 3-day trial reminder to ${to}`);
    // await this.send(to, template);
  }

  /**
   * Send trial reminder (1 day before expiration)
   */
  async sendTrialReminder1Day(to: string, userName: string, trialEndDate: Date): Promise<void> {
    const template = this.getTrialReminder1DayTemplate(userName, trialEndDate);
    console.log(`[EMAIL - DORMANT] Would send 1-day trial reminder to ${to}`);
    // await this.send(to, template);
  }

  /**
   * Send payment success notification
   */
  async sendPaymentSuccessEmail(to: string, userName: string, amount: number, nextBillingDate: Date): Promise<void> {
    const template = this.getPaymentSuccessTemplate(userName, amount, nextBillingDate);
    console.log(`[EMAIL - DORMANT] Would send payment success to ${to}`);
    // await this.send(to, template);
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailedEmail(to: string, userName: string, amount: number): Promise<void> {
    const template = this.getPaymentFailedTemplate(userName, amount);
    console.log(`[EMAIL - DORMANT] Would send payment failed to ${to}`);
    // await this.send(to, template);
  }

  /**
   * Send subscription cancellation confirmation
   */
  async sendCancellationEmail(to: string, userName: string, endDate: Date): Promise<void> {
    const template = this.getCancellationTemplate(userName, endDate);
    console.log(`[EMAIL - DORMANT] Would send cancellation confirmation to ${to}`);
    // await this.send(to, template);
  }

  /**
   * Send email via Resend (activate in production)
   */
  private async send(to: string, template: EmailTemplate): Promise<void> {
    // Production implementation:
    // const { Resend } = require('resend');
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: this.FROM_EMAIL,
    //   to,
    //   subject: template.subject,
    //   html: template.html,
    //   text: template.text,
    // });
    
    throw new Error("Email service not activated - production only");
  }

  // Email Templates

  private getWelcomeTemplate(userName: string): EmailTemplate {
    return {
      subject: "Welcome to FieldSnaps! 🎉",
      html: `
        <h1>Welcome to FieldSnaps, ${userName}!</h1>
        <p>You're all set with your 7-day free trial. No credit card required.</p>
        <p>FieldSnaps helps construction professionals capture and document job sites effortlessly.</p>
        <h2>Get Started:</h2>
        <ul>
          <li>Create your first project</li>
          <li>Capture photos with automatic timestamping</li>
          <li>Organize with tags and annotations</li>
        </ul>
        <p>Questions? Just reply to this email.</p>
        <p>Best,<br>The FieldSnaps Team</p>
      `,
      text: `Welcome to FieldSnaps, ${userName}! You're all set with your 7-day free trial...`,
    };
  }

  private getTrialReminder3DaysTemplate(userName: string, trialEndDate: Date): EmailTemplate {
    return {
      subject: "Your FieldSnaps trial ends in 3 days",
      html: `
        <h1>Hi ${userName},</h1>
        <p>Your FieldSnaps trial ends on ${trialEndDate.toLocaleDateString()}.</p>
        <p>Continue enjoying unlimited photo storage and project management for just $19.99/month.</p>
        <a href="https://fieldsnaps.com/subscribe">Subscribe Now</a>
        <p>Best,<br>The FieldSnaps Team</p>
      `,
      text: `Hi ${userName}, Your trial ends on ${trialEndDate.toLocaleDateString()}...`,
    };
  }

  private getTrialReminder1DayTemplate(userName: string, trialEndDate: Date): EmailTemplate {
    return {
      subject: "Last day of your FieldSnaps trial!",
      html: `
        <h1>Hi ${userName},</h1>
        <p><strong>Your trial ends tomorrow</strong> (${trialEndDate.toLocaleDateString()}).</p>
        <p>Don't lose access to your projects and photos. Subscribe now for $19.99/month.</p>
        <a href="https://fieldsnaps.com/subscribe">Continue with FieldSnaps</a>
        <p>Best,<br>The FieldSnaps Team</p>
      `,
      text: `Hi ${userName}, Your trial ends tomorrow...`,
    };
  }

  private getPaymentSuccessTemplate(userName: string, amount: number, nextBillingDate: Date): EmailTemplate {
    return {
      subject: "Payment Successful - FieldSnaps",
      html: `
        <h1>Thanks for your payment, ${userName}!</h1>
        <p>We've received your payment of $${(amount / 100).toFixed(2)}.</p>
        <p>Your next billing date: ${nextBillingDate.toLocaleDateString()}</p>
        <a href="https://fieldsnaps.com/settings/billing">View Billing Details</a>
        <p>Best,<br>The FieldSnaps Team</p>
      `,
      text: `Payment successful! Amount: $${(amount / 100).toFixed(2)}...`,
    };
  }

  private getPaymentFailedTemplate(userName: string, amount: number): EmailTemplate {
    return {
      subject: "Payment Failed - Action Required",
      html: `
        <h1>Hi ${userName},</h1>
        <p>We couldn't process your payment of $${(amount / 100).toFixed(2)}.</p>
        <p>Please update your payment method to avoid service interruption.</p>
        <a href="https://fieldsnaps.com/settings/billing">Update Payment Method</a>
        <p>Best,<br>The FieldSnaps Team</p>
      `,
      text: `Payment failed. Please update your payment method...`,
    };
  }

  private getCancellationTemplate(userName: string, endDate: Date): EmailTemplate {
    return {
      subject: "Subscription Cancelled - FieldSnaps",
      html: `
        <h1>Sorry to see you go, ${userName}</h1>
        <p>Your subscription has been cancelled. You'll retain access until ${endDate.toLocaleDateString()}.</p>
        <p>Changed your mind? You can reactivate anytime.</p>
        <a href="https://fieldsnaps.com/subscribe">Reactivate Subscription</a>
        <p>Best,<br>The FieldSnaps Team</p>
      `,
      text: `Subscription cancelled. Access until ${endDate.toLocaleDateString()}...`,
    };
  }
}

export const emailService = new EmailService();
