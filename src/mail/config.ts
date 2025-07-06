import { Resend } from "resend";

export const transporter = new Resend(process.env.RESEND_API_KEY!);

export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    if (!process.env.RESEND_API_KEY) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ Resend verification failed:", error);
    return false;
  }
};

export interface EmailData {
  firstName: string;
  lastName: string;
  email: string;
  orderId?: string;
  amount?: number;
  transactionId?: string;
  rejectionReason?: string;
}
