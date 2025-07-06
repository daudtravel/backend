import { transporter, EmailData } from "./config";

export const sendPaymentRefundEmail = async (
  emailData: EmailData
): Promise<void> => {
  try {
    const { firstName, lastName, email } = emailData;

    const subject = "Refund Processed Successfully 💰";
    const message =
      "Your refund has been successfully processed. You will see the amount reflected in your account within a few business days.";

    const text = `Dear ${firstName} ${lastName},

${message}

Thank you for your understanding.

Your Booking Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 16px; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
        <h2 style="color: #17a2b8; margin-top: 0;">Refund Processed 💰</h2>
        <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
        <p>${message}</p>
        <p>If you have any questions, feel free to contact our support team at <a href="mailto:support@yourdomain.com" style="color: #1976d2;">support@yourdomain.com</a>.</p>
        <p style="margin-bottom: 0;">Thank you for your understanding.<br><strong>Your Booking Team</strong></p>
      </div>
    `;

    console.log("📧 About to send refund email via Resend...");

    const { data, error } = await transporter.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: email,
      subject,
      text,
      html,
    });

    if (error) {
      console.error("❌ Error sending refund email:", error);
      throw error;
    }

    console.log("✅ Refund email sent successfully! ID:", data?.id);
  } catch (error) {
    console.error("❌ Error in sendPaymentRefundEmail:", error);
    throw error;
  }
};
