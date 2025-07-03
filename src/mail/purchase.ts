import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number.parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Add these options to help with email delivery
  tls: {
    rejectUnauthorized: false,
  },
  debug: process.env.NODE_ENV === "development",
  logger: process.env.NODE_ENV === "development",
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP configuration error:", error);
  } else {
    console.log("✅ SMTP server is ready to send emails");
  }
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

interface FailedPaymentDetails {
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  tourName: string;
  selectedDate: string;
  peopleAmount: number;
  totalTourPrice: number;
  amountPaid: number;
  externalOrderId: string;
  failureReason: string;
  paymentStatus: string;
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

    // Validate email address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      throw new Error(`Invalid email address: ${customerEmail}`);
    }

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

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="text-align: center; padding: 30px 20px; background-color: #2c5530; color: white;">
            <h1 style="margin: 0; font-size: 28px;">🎉 Booking Confirmed!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Thank you for your purchase</p>
          </div>
          
          <div style="padding: 30px 20px;">
            <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
              <h2 style="color: #2c5530; margin: 0 0 15px 0; font-size: 24px;">Hello ${customerFirstName} ${customerLastName}!</h2>
              <p style="color: #333; line-height: 1.6; margin: 0; font-size: 16px;">
                We're excited to confirm your booking for <strong>${tourName}</strong>. 
                Your payment has been successfully processed and your tour is now confirmed.
              </p>
            </div>

            <div style="border: 1px solid #e0e0e0; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
              <h3 style="color: #2c5530; margin: 0 0 20px 0; font-size: 20px; border-bottom: 2px solid #2c5530; padding-bottom: 10px;">
                📋 Booking Details
              </h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Order ID:</td>
                  <td style="padding: 8px 0; color: #333;">${externalOrderId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Tour Name:</td>
                  <td style="padding: 8px 0; color: #333;">${tourName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Date:</td>
                  <td style="padding: 8px 0; color: #333;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Duration:</td>
                  <td style="padding: 8px 0; color: #333;">${tourDurationDays} days, ${tourDurationNights} nights</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Number of People:</td>
                  <td style="padding: 8px 0; color: #333;">${peopleAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Start Location:</td>
                  <td style="padding: 8px 0; color: #333;">${startLocation}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">End Location:</td>
                  <td style="padding: 8px 0; color: #333;">${endLocation}</td>
                </tr>
                ${
                  locations && locations.length > 0
                    ? `
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Tour Locations:</td>
                  <td style="padding: 8px 0; color: #333;">${locations.join(
                    ", "
                  )}</td>
                </tr>
                `
                    : ""
                }
              </table>
            </div>

            <div style="border: 1px solid #e0e0e0; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
              <h3 style="color: #2c5530; margin: 0 0 20px 0; font-size: 20px; border-bottom: 2px solid #2c5530; padding-bottom: 10px;">
                💳 Payment Information
              </h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Total Tour Price:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold;">$${totalTourPrice}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Amount Paid:</td>
                  <td style="padding: 8px 0; color: #28a745; font-weight: bold;">$${amountPaid}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Payment Status:</td>
                  <td style="padding: 8px 0;">
                    ${
                      isFullPayment
                        ? '<span style="color: #28a745; font-weight: bold;">✅ Fully Paid</span>'
                        : `<span style="color: #ffc107; font-weight: bold;">⏳ Partial Payment</span><br><span style="color: #d63384; font-size: 14px;">Remaining: $${amountRemaining}</span>`
                    }
                  </td>
                </tr>
              </table>
            </div>

            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <h3 style="color: #2c5530; margin: 0 0 15px 0; font-size: 18px;">📞 What's Next?</h3>
              <ul style="color: #333; line-height: 1.6; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">You'll receive a detailed itinerary 48 hours before your tour</li>
                <li style="margin-bottom: 8px;">Our team will contact you if any additional information is needed</li>
                <li style="margin-bottom: 8px;">Keep this email as your booking confirmation</li>
                ${
                  !isFullPayment
                    ? '<li style="color: #d63384; font-weight: bold;">Please note: Remaining payment will be due before your tour date</li>'
                    : ""
                }
              </ul>
            </div>

            <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e0e0e0;">
              <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">
                If you have any questions, please contact us at:
              </p>
              <p style="margin: 0;">
                <a href="mailto:support@daudtravel.com" style="color: #2c5530; text-decoration: none; font-weight: bold;">support@daudtravel.com</a>
              </p>
            </div>

            <div style="text-align: center; padding: 15px 0; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This is an automated email. Please do not reply to this message.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: {
        name: "Daud Travel",
        address: process.env.SMTP_FROM || "noreply@daudtravel.com",
      },
      to: customerEmail,
      subject: `🎉 Booking Confirmed - ${tourName} | Order #${externalOrderId}`,
      html: emailHtml,
      // Add text version for better deliverability
      text: `
        Booking Confirmed!
        
        Hello ${customerFirstName} ${customerLastName},
        
        Your booking for ${tourName} has been confirmed.
        
        Order ID: ${externalOrderId}
        Date: ${formattedDate}
        Duration: ${tourDurationDays} days, ${tourDurationNights} nights
        People: ${peopleAmount}
        
        Payment Information:
        Total: $${totalTourPrice}
        Paid: $${amountPaid}
        Status: ${
          isFullPayment
            ? "Fully Paid"
            : `Partial Payment (Remaining: $${amountRemaining})`
        }
        
        Contact us at support@daudtravel.com if you have any questions.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Success email sent:", {
      messageId: info.messageId,
      to: customerEmail,
      orderId: externalOrderId,
    });
  } catch (error) {
    console.error("❌ Error sending success email:", error);
    throw error;
  }
};

export const sendFailedPaymentEmail = async (
  failedPaymentDetails: FailedPaymentDetails
): Promise<void> => {
  try {
    const {
      customerFirstName,
      customerLastName,
      customerEmail,
      tourName,
      selectedDate,
      peopleAmount,
      totalTourPrice,
      amountPaid,
      externalOrderId,
      failureReason,
      paymentStatus,
    } = failedPaymentDetails;

    // Validate email address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      throw new Error(`Invalid email address: ${customerEmail}`);
    }

    const formattedDate = new Date(selectedDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Failed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="text-align: center; padding: 30px 20px; background-color: #dc3545; color: white;">
            <h1 style="margin: 0; font-size: 28px;">❌ Payment Failed</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">We encountered an issue with your payment</p>
          </div>
          
          <div style="padding: 30px 20px;">
            <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
              <h2 style="color: #dc3545; margin: 0 0 15px 0; font-size: 24px;">Hello ${customerFirstName} ${customerLastName},</h2>
              <p style="color: #333; line-height: 1.6; margin: 0; font-size: 16px;">
                Unfortunately, we were unable to process your payment for <strong>${tourName}</strong>. 
                Don't worry - your tour is still available and you can try again.
              </p>
            </div>

            <div style="border: 1px solid #e0e0e0; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
              <h3 style="color: #dc3545; margin: 0 0 20px 0; font-size: 20px; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">
                📋 Booking Details
              </h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Order ID:</td>
                  <td style="padding: 8px 0; color: #333;">${externalOrderId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Tour Name:</td>
                  <td style="padding: 8px 0; color: #333;">${tourName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Date:</td>
                  <td style="padding: 8px 0; color: #333;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Number of People:</td>
                  <td style="padding: 8px 0; color: #333;">${peopleAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Total Price:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold;">$${totalTourPrice}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Attempted Payment:</td>
                  <td style="padding: 8px 0; color: #333;">$${amountPaid}</td>
                </tr>
              </table>
            </div>

            <div style="border: 1px solid #dc3545; background-color: #f8d7da; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <h3 style="color: #721c24; margin: 0 0 15px 0; font-size: 18px;">❌ Payment Issue</h3>
              <p style="color: #721c24; margin: 0; font-weight: bold;">Status: ${paymentStatus}</p>
              <p style="color: #721c24; margin: 10px 0 0 0;">Reason: ${failureReason}</p>
            </div>

            <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <h3 style="color: #0c5460; margin: 0 0 15px 0; font-size: 18px;">🔄 What to do next?</h3>
              <ul style="color: #0c5460; line-height: 1.6; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Check your payment method and try again</li>
                <li style="margin-bottom: 8px;">Ensure you have sufficient funds available</li>
                <li style="margin-bottom: 8px;">Contact your bank if the issue persists</li>
                <li style="margin-bottom: 8px;">Reach out to our support team for assistance</li>
              </ul>
            </div>

            <div style="text-align: center; margin-bottom: 25px;">
              <a href="https://daudtravel.com/tours" 
                 style="display: inline-block; background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                Try Booking Again
              </a>
            </div>

            <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e0e0e0;">
              <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">
                Need help? Contact our support team:
              </p>
              <p style="margin: 0;">
                <a href="mailto:support@daudtravel.com" style="color: #dc3545; text-decoration: none; font-weight: bold;">support@daudtravel.com</a>
              </p>
            </div>

            <div style="text-align: center; padding: 15px 0; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This is an automated email. Please do not reply to this message.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: {
        name: "Daud Travel",
        address: process.env.SMTP_FROM || "noreply@daudtravel.com",
      },
      to: customerEmail,
      subject: `❌ Payment Failed - ${tourName} | Order #${externalOrderId}`,
      html: emailHtml,
      text: `
        Payment Failed
        
        Hello ${customerFirstName} ${customerLastName},
        
        We were unable to process your payment for ${tourName}.
        
        Order ID: ${externalOrderId}
        Date: ${formattedDate}
        Amount: $${amountPaid}
        Status: ${paymentStatus}
        Reason: ${failureReason}
        
        Please try again or contact support@daudtravel.com for assistance.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Failed payment email sent:", {
      messageId: info.messageId,
      to: customerEmail,
      orderId: externalOrderId,
    });
  } catch (error) {
    console.error("❌ Error sending failed payment email:", error);
    throw error;
  }
};
