import nodemailer from "nodemailer";

interface BookingData {
  firstName: string;
  lastName: string;
  email: string;
}

// Configure your email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number.parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
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
      <div style="font-family: Arial, sans-serif; font-size: 16px;">
        <p>Dear ${firstName} ${lastName},</p>
        <p>Congratulations! Your booking has been successfully confirmed.</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.FROM_EMAIL || "noreply@yourdomain.com",
      to: email,
      subject,
      text,
      html,
    });

    console.log(`✅ Simple email sent to ${email}`);
  } catch (error) {
    console.error("❌ Error sending simple email:", error);
    throw error;
  }
};
