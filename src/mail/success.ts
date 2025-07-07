import { transporter, EmailData } from "./config";

export const sendPaymentSuccessEmail = async (
  emailData: EmailData & { detailsLink: string }
): Promise<void> => {
  try {
    const { firstName, lastName, email, detailsLink } = emailData;
    const subject = "Tour Purchase Confirmation 🎉";
    const message =
      "Congratulations! You’ve purchased our tour. You can view all the details using the link below:";

    const text = `${message}\n\n${detailsLink}`;

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 16px; max-width: 600px; margin: 0 auto; padding: 20px;">
        <p>${message}</p>
        <p><a href="${detailsLink}" style="color: #1e88e5;" target="_blank">${detailsLink}</a></p>
        <p>— ${firstName} ${lastName}</p>
      </div>
    `;
    const { data, error } = await transporter.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "noreply@daudtravel.com",
      to: email && "traveldaud@gmail.com",
      subject,
      text,
      html,
    });
    if (error) {
      console.error("❌ Error sending payment success email:", error);
      throw error;
    }
  } catch (error) {
    console.error("❌ Error in sendPaymentSuccessEmail:", error);
    throw error;
  }
};
