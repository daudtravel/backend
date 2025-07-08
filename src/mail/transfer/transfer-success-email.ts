import { transporter, EmailData } from "../config";

interface TransferEmailData extends EmailData {
  detailsLink: string;
  transferName: string;
  transferDate: string;
  transferTime: string;
  startLocation: string;
  endLocation: string;
  vehicleType: string;
  passengerCount: number;
  paidAmount: number;
}

export const sendTransferPaymentSuccessEmail = async (
  emailData: TransferEmailData
): Promise<void> => {
  try {
    const {
      email,
      detailsLink,
      transferName,
      transferDate,
      transferTime,
      startLocation,
      endLocation,
      vehicleType,
      passengerCount,
      paidAmount,
    } = emailData;

    const subject = "Transfer Booking Confirmation 🚗";
    const message =
      "Great news! Your transfer has been successfully booked and paid for. Here are your booking details:";

    // Format date and time for display
    const formattedDate = new Date(transferDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const formattedTime = new Date(transferTime).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const text = `${message}

Transfer Details:
- Service: ${transferName}
- Date: ${formattedDate}
- Time: ${formattedTime}
- Route: ${startLocation} → ${endLocation}
- Vehicle: ${vehicleType}
- Passengers: ${passengerCount}
- Amount Paid: ₾${paidAmount}

View full details: ${detailsLink}

Thank you for choosing Daud Travel!`;

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 16px; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #1e88e5; margin-bottom: 20px; text-align: center;">Transfer Booking Confirmed! 🚗</h2>
          
          <p style="color: #333; line-height: 1.6; margin-bottom: 25px;">${message}</p>
          
          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #1e88e5; margin-top: 0; margin-bottom: 15px;">Transfer Details</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Service:</td>
                <td style="padding: 10px 0; color: #333;">${transferName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Date:</td>
                <td style="padding: 10px 0; color: #333;">${formattedDate}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Time:</td>
                <td style="padding: 10px 0; color: #333;">${formattedTime}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Route:</td>
                <td style="padding: 10px 0; color: #333;">${startLocation} → ${endLocation}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Vehicle:</td>
                <td style="padding: 10px 0; color: #333;">${vehicleType}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Passengers:</td>
                <td style="padding: 10px 0; color: #333;">${passengerCount}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Amount Paid:</td>
                <td style="padding: 10px 0; color: #1e88e5; font-weight: bold; font-size: 18px;">₾${paidAmount}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin-bottom: 25px;">
            <a href="${detailsLink}" 
               style="background-color: #1e88e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;"
               target="_blank">
              View Full Details
            </a>
          </div>
          
          <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #2e7d32; font-weight: bold;">
              💡 Important: Please be ready 15 minutes before your scheduled pickup time.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">
          
          <p style="color: #666; font-size: 14px; text-align: center; margin-bottom: 10px;">
            Thank you for choosing Daud Travel!
          </p>
          
          <p style="color: #888; font-size: 12px; text-align: center; margin: 0;">
            If you have any questions, please contact us at traveldaud@gmail.com
          </p>
        </div>
      </div>
    `;

    const { data, error } = await transporter.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "noreply@daudtravel.com",
      to: [email, "traveldaud@gmail.com"],
      subject,
      text,
      html,
    });

    if (error) {
      console.error("❌ Error sending transfer payment success email:", error);
      throw error;
    }
  } catch (error) {
    console.error("❌ Error in sendTransferPaymentSuccessEmail:", error);
    throw error;
  }
};
