import { transporter } from "../config";
import pool from "../../config/sql";

export const sendVerificationEmail = async (email: string, code: string) => {
  try {
    const { data, error } = await transporter.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "traveldaud@gmail.com",
      to: email,
      subject: "Verify Your Daud Travel Account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; margin-bottom: 10px;">Email Verification</h1>
              <div style="width: 60px; height: 4px; background-color: #2196F3; margin: 0 auto;"></div>
            </div>
            
            <p style="color: #666; line-height: 1.6; text-align: center; font-size: 16px;">
              Thank you for signing up with <strong>Daud Travel</strong>. To complete your registration, please use the verification code below:
            </p>
            
            <div style="background-color: #e7f3fe; border: 2px solid #2196F3; border-radius: 8px; padding: 25px; margin: 30px 0; text-align: center;">
              <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">Your verification code:</p>
              <p style="font-size: 32px; color: #2196F3; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">
                ${code}
              </p>
            </div>
            
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                ⏰ <strong>Important:</strong> This code will expire in 15 minutes for security reasons.
              </p>
            </div>
            
            <p style="color: #666; line-height: 1.6; text-align: center; font-size: 14px;">
              If you did not create an account with Daud Travel, please ignore this email and no action will be taken.
            </p>
            
            <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
              <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
                © 2024 Daud Travel. All rights reserved.<br>
                This is an automated message, please do not reply to this email.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
        Welcome to Daud Travel!
        
        Your verification code is: ${code}
        
        This code will expire in 15 minutes.
        
        If you did not create an account with Daud Travel, please ignore this email.
        
        © 2024 Daud Travel. All rights reserved.
      `,
    });

    if (error) {
      console.error(`❌ Failed to send verification email to ${email}`, error);
      throw new Error("Failed to send verification email. Please try again.");
    }

    console.log(`✅ Verification email sent to ${email}`, data?.id);
  } catch (error) {
    console.error(`❌ Failed to send verification email to ${email}`, error);
    throw new Error("Failed to send verification email. Please try again.");
  }
};

export const storeVerificationCode = async (email: string, code: string) => {
  const query = `
    INSERT INTO email_verification (email, code, created_at) 
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (email) 
    DO UPDATE SET 
      code = $2, 
      created_at = CURRENT_TIMESTAMP
  `;

  try {
    await pool.query(query, [email, code]);
  } catch (error) {
    console.error("❌ Error storing verification code:", error);
    throw new Error("Failed to store verification code");
  }
};

export const verifyEmailCode = async (email: string, code: string) => {
  const query = `
    SELECT * FROM email_verification 
    WHERE email = $1 AND code = $2 
    AND created_at > CURRENT_TIMESTAMP - INTERVAL '15 minutes'
  `;

  try {
    const result = await pool.query(query, [email, code]);
    if (result.rows.length > 0) {
      await pool.query("DELETE FROM email_verification WHERE email = $1", [
        email,
      ]);

      return true;
    }

    return false;
  } catch (error) {
    throw new Error("Failed to verify email code");
  }
};

export const resendVerificationCode = async (email: string, code: string) => {
  try {
    const checkQuery = `
      SELECT created_at FROM email_verification 
      WHERE email = $1 
      AND created_at > CURRENT_TIMESTAMP - INTERVAL '15 minutes'
    `;

    const result = await pool.query(checkQuery, [email]);

    if (result.rows.length > 0) {
      const createdAt = new Date(result.rows[0].created_at);
      const now = new Date();
      const timeDiff = now.getTime() - createdAt.getTime();
      const timeElapsedSeconds = Math.floor(timeDiff / 1000);
      const cooldownSeconds = 2 * 60;

      if (timeElapsedSeconds < cooldownSeconds) {
        const timeRemaining = cooldownSeconds - timeElapsedSeconds;
        const error = new Error("VERIFICATION_CODE_ALREADY_SENT");
        (error as any).status = 429;
        (error as any).timeRemaining = timeRemaining;
        throw error;
      }
    }
    await storeVerificationCode(email, code);
    await sendVerificationEmail(email, code);
  } catch (error) {
    console.error("❌ Error resending verification code:", error);
    throw error;
  }
};

export const cleanupExpiredCodes = async () => {
  const query = `
    DELETE FROM email_verification 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
  `;

  try {
    await pool.query(query);
  } catch (error) {
    console.error("❌ Error cleaning up expired codes:", error);
  }
};
