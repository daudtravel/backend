import { Resend } from "resend";

// Email transporter configuration
export const transporter = new Resend(process.env.RESEND_API_KEY!);

// Optional: Verify transporter connection
export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY not set");
      return false;
    }
    console.log("✅ Resend connection verified");
    return true;
  } catch (error) {
    console.error("❌ Resend verification failed:", error);
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
