import nodemailer from 'nodemailer';
import pool from '../config/sql';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', 
  port: 587,
  secure: false, 
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD
  }
});

export const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendVerificationEmail = async (email: string, code: string) => {
  try {
    await transporter.sendMail({
      from: '"Daud Travel" <noreply@daudtravel.com>',
      to: email,
      subject: 'Verify Your Daud Travel Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h1 style="color: #333; text-align: center; margin-bottom: 20px;">Email Verification</h1>
            
            <p style="color: #666; line-height: 1.6; text-align: center;">
              Thank you for signing up with Daud Travel. To complete your registration, please use the verification code below:
            </p>
            
            <div style="background-color: #e7f3fe; border-left: 4px solid #2196F3; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="font-size: 24px; color: #333; font-weight: bold; letter-spacing: 5px; margin: 0;">
                ${code}
              </p>
            </div>
            
            <p style="color: #666; line-height: 1.6; text-align: center;">
              This code will expire in 15 minutes. If you did not create an account with Daud Travel, please ignore this email.
            </p>
            
            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
              © 2024 Daud Travel. All rights reserved.
            </p>
          </div>
        </div>
      `,
    });
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error(`Failed to send verification email to ${email}`, error);
    throw new Error('Failed to send verification email. Please try again.');
  }
};

export const storeVerificationCode = async (email: string, code: string) => {
  const query = `
    INSERT INTO email_verification (email, code, created_at) 
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (email) DO UPDATE 
    SET code = $2, created_at = CURRENT_TIMESTAMP
  `;
  
  try {
    await pool.query(query, [email, code]);
  } catch (error) {
    console.error('Error storing verification code:', error);
    throw new Error('Failed to store verification code');
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
      await pool.query('DELETE FROM email_verification WHERE email = $1', [email]);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error verifying email code:', error);
    throw new Error('Failed to verify email code');
  }
};

