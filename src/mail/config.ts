import nodemailer from "nodemailer";

// Email transporter configuration
export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD,
  },
});

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

// Common email interface
export interface EmailData {
  firstName: string;
  lastName: string;
  email: string;
  orderId?: string;
  amount?: number;
  transactionId?: string;
  rejectionReason?: string;
}
