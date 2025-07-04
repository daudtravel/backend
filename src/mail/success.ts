import { transporter, EmailData } from "./config";

export const sendPaymentSuccessEmail = async (
  emailData: EmailData
): Promise<void> => {
  try {
    const { firstName, lastName, email, orderId, amount, transactionId } =
      emailData;

    const subject = "Payment Successful - Booking Confirmed! 🎉";

    const text = `Dear ${firstName} ${lastName},

Great news! Your payment has been successfully processed and your booking is now confirmed.

Order Details:
- Order ID: ${orderId || "N/A"}
- Transaction ID: ${transactionId || "N/A"}
- Amount: ${amount ? `$${amount}` : "N/A"}

Thank you for your business!

Best regards,
Your Booking Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 16px; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #28a745; margin-top: 0;">Payment Successful! 🎉</h2>
          <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
          <p>Great news! Your payment has been successfully processed and your booking is now confirmed.</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #28a745;">
            <h3 style="color: #28a745; margin-top: 0;">Order Details</h3>
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
                <td style="padding: 8px 0; font-weight: bold;">Amount:</td>
                <td style="padding: 8px 0; color: #28a745; font-weight: bold;">${
                  amount ? `$${amount}` : "N/A"
                }</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #2e7d32;">
              <strong>What's Next?</strong><br>
              You will receive additional details about your booking shortly. If you have any questions, feel free to contact our support team.
            </p>
          </div>
          
          <p style="margin-bottom: 0;">Thank you for your business!<br><strong>Your Booking Team</strong></p>
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
      `✅ Payment success email sent to ${email} for order ${orderId}`
    );
  } catch (error) {
    console.error("❌ Error sending payment success email:", error);
    throw error;
  }
};
