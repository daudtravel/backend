import nodemailer from 'nodemailer';
 

 
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,  
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface BookingDetails {
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  tourName: string;
  selectedDate: string;
  peopleAmount: number;
  tourDurationDays: number;
  tourDurationNights: number;
  startLocation: string;
  endLocation: string;
  locations?: string[];
  totalTourPrice: number;
  amountPaid: number;
  externalOrderId: string;
  isFullPayment: boolean;
  amountRemaining?: number;
}

export const sendSuccessfulPurchaseEmail = async (
  bookingDetails: BookingDetails
): Promise<void> => {
  try {
    const {
      customerFirstName,
      customerLastName,
      customerEmail,
      tourName,
      selectedDate,
      peopleAmount,
      tourDurationDays,
      tourDurationNights,
      startLocation,
      endLocation,
      locations,
      totalTourPrice,
      amountPaid,
      externalOrderId,
      isFullPayment,
      amountRemaining,
    } = bookingDetails;

    const formattedDate = new Date(selectedDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const locationsText =
      locations && locations.length > 0
        ? `<p><strong>Tour Locations:</strong> ${locations.join(", ")}</p>`
        : "";

    const paymentStatusText = isFullPayment
      ? "<p><strong>Payment Status:</strong> Fully Paid</p>"
      : `<p><strong>Payment Status:</strong> Partial Payment (Remaining: $${amountRemaining})</p>`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c5530; margin-bottom: 10px;">🎉 Booking Confirmed!</h1>
          <p style="color: #666; font-size: 16px;">Thank you for your purchase</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
          <h2 style="color: #2c5530; margin-top: 0;">Hello ${customerFirstName} ${customerLastName}!</h2>
          <p style="color: #333; line-height: 1.6;">
            We're excited to confirm your booking for <strong>${tourName}</strong>. 
            Your payment has been successfully processed and your tour is now confirmed.
          </p>
        </div>

        <div style="background-color: #fff; border: 1px solid #e0e0e0; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
          <h3 style="color: #2c5530; margin-top: 0; border-bottom: 2px solid #2c5530; padding-bottom: 10px;">
            📋 Booking Details
          </h3>
          
          <div style="margin-bottom: 15px;">
            <p><strong>Order ID:</strong> ${externalOrderId}</p>
            <p><strong>Tour Name:</strong> ${tourName}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Duration:</strong> ${tourDurationDays} days, ${tourDurationNights} nights</p>
            <p><strong>Number of People:</strong> ${peopleAmount}</p>
            <p><strong>Start Location:</strong> ${startLocation}</p>
            <p><strong>End Location:</strong> ${endLocation}</p>
            ${locationsText}
          </div>
        </div>

        <div style="background-color: #fff; border: 1px solid #e0e0e0; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
          <h3 style="color: #2c5530; margin-top: 0; border-bottom: 2px solid #2c5530; padding-bottom: 10px;">
            💳 Payment Information
          </h3>
          
          <p><strong>Total Tour Price:</strong> $${totalTourPrice}</p>
          <p><strong>Amount Paid:</strong> $${amountPaid}</p>
          ${paymentStatusText}
        </div>

        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <h3 style="color: #2c5530; margin-top: 0;">📞 What's Next?</h3>
          <p style="color: #333; line-height: 1.6; margin-bottom: 10px;">
            • You'll receive a detailed itinerary 48 hours before your tour
            • Our team will contact you if any additional information is needed
            • Keep this email as your booking confirmation
          </p>
          ${
            !isFullPayment
              ? '<p style="color: #d63384; font-weight: bold;">• Please note: Remaining payment will be due before your tour date</p>'
              : ""
          }
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #666; font-size: 14px;">
            If you have any questions, please contact us at:<br>
            <a href="mailto:support@yourcompany.com" style="color: #2c5530;">support@yourcompany.com</a>
          </p>
        </div>

        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 12px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || "noreply@yourcompany.com",
      to: customerEmail,
      subject: `🎉 Booking Confirmed - ${tourName} | Order #${externalOrderId}`,
      html: emailHtml,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Success email sent to:", customerEmail);
  } catch (error) {
    console.error("❌ Error sending success email:", error);
    throw error;
  }
};
