import { transporter, EmailData } from "./config";

export const sendPaymentFailureEmail = async (
  emailData: EmailData
): Promise<void> => {
  try {
    const { firstName, lastName, email, orderId, amount, rejectionReason } =
      emailData;

    const subject = "Payment Failed - Action Required ⚠️";

    const text = `Dear ${firstName} ${lastName},

We're sorry to inform you that your payment could not be processed.

Order Details:
- Order ID: ${orderId || "N/A"}
- Amount: ${amount ? `$${amount}` : "N/A"}
- Reason: ${rejectionReason || "Payment was declined"}

Please try again with a different payment method or contact our support team for assistance.

Best regards,
Your Booking Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 16px; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #dc3545; margin-top: 0;">Payment Failed ⚠️</h2>
          <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
          <p>We're sorry to inform you that your payment could not be processed.</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <h3 style="color: #dc3545; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Order ID:</td>
                <td style="padding: 8px 0;">${orderId || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Amount:</td>
                <td style="padding: 8px 0; font-weight: bold;">${
                  amount ? `$${amount}` : "N/A"
                }</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Reason:</td>
                <td style="padding: 8px 0; color: #dc3545;">${
                  rejectionReason || "Payment was declined"
                }</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;">
              <strong>What You Can Do:</strong><br>
              • Try using a different payment method<br>
              • Check your card details and try again<br>
              • Contact your bank if the issue persists<br>
              • Reach out to our support team for assistance
            </p>
          </div>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #1976d2;">
              <strong>Need Help?</strong><br>
              Our support team is here to help you complete your booking. Contact us at support@yourdomain.com or call our helpline.
            </p>
          </div>
          
          <p style="margin-bottom: 0;">We apologize for any inconvenience.<br><strong>Your Booking Team</strong></p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.GMAIL_USER || "noreply@yourdomain.com",
      to: email,
      subject,
      text,
      html,
    });

    console.log(
      `✅ Payment failure email sent to ${email} for order ${orderId}`
    );
  } catch (error) {
    console.error("❌ Error sending payment failure email:", error);
    throw error;
  }
};
