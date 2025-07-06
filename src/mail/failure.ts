import { transporter, EmailData } from "./config";

export const sendPaymentFailureEmail = async (
  emailData: EmailData & { rejectionReason?: string }
): Promise<void> => {
  try {
    const { firstName, lastName, email, rejectionReason } = emailData;

    const subject = "Payment Failed - Please Try Again ⚠️";
    const reason = rejectionReason || "Payment was declined by the provider.";
    const message =
      "Unfortunately, your payment could not be processed. Please try again or contact our support team if you need help.";

    const text = `Dear ${firstName} ${lastName},

${message}

Reason: ${reason}

Your Booking Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 16px; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
        <h2 style="color: #dc3545;">Payment Failed ⚠️</h2>
        <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
        <p>${message}</p>
        <p style="color: #dc3545;"><strong>Reason:</strong> ${reason}</p>
        <p>If you need help, reach out to us at <a href="mailto:support@yourdomain.com" style="color: #1976d2;">support@yourdomain.com</a>.</p>
        <p style="margin-bottom: 0;">Your Booking Team</p>
      </div>
    `;

    console.log("📧 About to send payment failure email via Resend...");

    const { data, error } = await transporter.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: email,
      subject,
      text,
      html,
    });

    if (error) {
      console.error("❌ Error sending payment failure email:", error);
      throw error;
    }

    console.log("✅ Payment failure email sent successfully! ID:", data?.id);
  } catch (error) {
    console.error("❌ Error in sendPaymentFailureEmail:", error);
    throw error;
  }
};
