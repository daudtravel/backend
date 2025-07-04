import { transporter, EmailData } from "./config";

export const sendPaymentRefundEmail = async (
  emailData: EmailData
): Promise<void> => {
  try {
    const { firstName, lastName, email, orderId, amount, transactionId } =
      emailData;

    const subject = "Payment Refunded - Processing Complete 💰";

    const text = `Dear ${firstName} ${lastName},

Your refund has been successfully processed.

Refund Details:
- Order ID: ${orderId || "N/A"}
- Transaction ID: ${transactionId || "N/A"}
- Refund Amount: ${amount ? `$${amount}` : "N/A"}

The refunded amount will appear in your account within 3-5 business days.

Best regards,
Your Booking Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 16px; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #17a2b8; margin-top: 0;">Payment Refunded 💰</h2>
          <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
          <p>Your refund has been successfully processed.</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #17a2b8;">
            <h3 style="color: #17a2b8; margin-top: 0;">Refund Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Order ID:</td>
                <td style="padding: 8px 0;">${orderId || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Transaction ID:</td>
                <td style="padding: 8px 0;">${transactionId || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Refund Amount:</td>
                <td style="padding: 8px 0; color: #17a2b8; font-weight: bold;">${
                  amount ? `$${amount}` : "N/A"
                }</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #e8f4f8; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #0c5460;">
              <strong>Important Information:</strong><br>
              • The refunded amount will appear in your account within 3-5 business days<br>
              • The refund will be processed to your original payment method<br>
              • You will receive a separate notification from your bank/card provider
            </p>
          </div>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #1976d2;">
              <strong>Questions?</strong><br>
              If you have any questions about your refund, please contact our support team at support@yourdomain.com.
            </p>
          </div>
          
          <p style="margin-bottom: 0;">Thank you for your understanding.<br><strong>Your Booking Team</strong></p>
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
      `✅ Payment refund email sent to ${email} for order ${orderId}`
    );
  } catch (error) {
    console.error("❌ Error sending payment refund email:", error);
    throw error;
  }
};
