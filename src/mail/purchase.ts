import nodemailer from "nodemailer";

interface BookingData {
  firstName: string;
  lastName: string;
  email: string;
}

// Option 1: Using Gmail service (simpler - no host needed)
const transporter = nodemailer.createTransport({
  service: "gmail", // This automatically sets host, port, and secure
  auth: {
    user: process.env.GMAIL_USER, // your-email@gmail.com
    pass: process.env.GMAIL_APP_PASSWORD, // 16-character app password
  },
});


export const sendBookingConfirmationEmail = async (
  bookingData: BookingData
): Promise<void> => {
  try {
    const { firstName, lastName, email } = bookingData;

    const subject = "Congratulations on Your Booking!";
    const text = `Dear ${firstName} ${lastName},\n\nCongratulations! Your booking has been successfully confirmed.`;
    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 16px; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #28a745; margin-top: 0;">Booking Confirmed! 🎉</h2>
          <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
          <p>Congratulations! Your booking has been successfully confirmed.</p>
          <div style="background-color: white; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #6c757d;">
              If you have any questions, feel free to contact us.
            </p>
          </div>
          <p style="margin-bottom: 0;">Best regards,<br>Your Booking Team</p>
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

    console.log(`✅ Booking confirmation email sent to ${email}`);
  } catch (error) {
    console.error("❌ Error sending booking confirmation email:", error);
    throw error;
  }
};

// Optional: Verify transporter connection
export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    await transporter.verify();
    console.log("✅ Gmail SMTP connection verified");
    return true;
  } catch (error) {
    console.error("❌ Gmail SMTP verification failed:", error);
    return false;
  }
};
