import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getBOGAccessToken } from "./getBOGAccessToken";
import { BOG_API_URL, getCallbackUrl, MOCK_MODE } from "./payments";
import pool from "../../config/sql";

// Simplified booking data interface
interface BookingData {
  // Customer Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;

  // Booking Details
  peopleAmount: number;
  selectedDate: Date;
  tourDurationDays?: number;
  tourDurationNights?: number;

  // Payment Details
  paymentType: boolean; // true = full payment, false = reservation
  paymentAmount: number; // amount being paid now
  totalTourPrice: number; // total price of the tour
  remainingAmount?: number; // amount left to pay (for reservations)

  // Tour Information
  tourName: string;
  tourDescription?: string;
  startLocation?: string;
  endLocation?: string;
  locations?: string[]; // only include if not empty
}

interface PaymentRequest {
  bookingData: BookingData;
}

// Helper function to extract plain text from rich text editor format
const extractPlainText = (description: string | undefined): string | null => {
  if (!description) return null;

  try {
    // Try to parse as JSON (rich text editor format)
    const parsed = JSON.parse(description);
    if (parsed.blocks && Array.isArray(parsed.blocks)) {
      return (
        parsed.blocks
          .map((block: any) => block.text || "")
          .filter((text: string) => text.trim())
          .join(" ")
          .trim() || null
      );
    }
    return description.trim() || null;
  } catch {
    // If it's not JSON, return as plain text
    return description.trim() || null;
  }
};

export const createBOGPaymentWithBookingData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { bookingData }: PaymentRequest = req.body;

    // Validate booking_data exists
    if (!bookingData) {
      res.status(400).json({
        success: false,
        message: "Booking data is required",
      });
      return;
    }

    // Extract and validate required fields
    const {
      paymentAmount,
      totalTourPrice,
      firstName,
      lastName,
      email,
      phone,
      tourName,
      peopleAmount,
      selectedDate,
      paymentType,
      remainingAmount,
    } = bookingData;

    // Validate required fields
    if (!paymentAmount || paymentAmount <= 0) {
      res.status(400).json({
        success: false,
        message: "Payment amount is required and must be positive",
      });
      return;
    }

    if (!totalTourPrice || totalTourPrice <= 0) {
      res.status(400).json({
        success: false,
        message: "Total tour price is required and must be positive",
      });
      return;
    }

    if (paymentAmount > totalTourPrice) {
      res.status(400).json({
        success: false,
        message: "Payment amount cannot exceed total tour price",
      });
      return;
    }

    if (!firstName || !lastName || !email || !phone) {
      res.status(400).json({
        success: false,
        message:
          "Customer information (firstName, lastName, email, phone) is required",
      });
      return;
    }

    if (!tourName || !peopleAmount || !selectedDate) {
      res.status(400).json({
        success: false,
        message:
          "Tour information (tourName, peopleAmount, selectedDate) is required",
      });
      return;
    }

    // Validate reservation logic
    if (!paymentType && (!remainingAmount || remainingAmount <= 0)) {
      res.status(400).json({
        success: false,
        message: "Remaining amount is required for reservation payments",
      });
      return;
    }

    // Create unique order ID
    const external_order_id = `ORDER_${uuidv4()}`;

    console.log("🏦 Creating BOG payment with booking data:", {
      external_order_id,
      paymentAmount,
      totalTourPrice,
      customer: { firstName, lastName, email, phone },
      tour: tourName,
      people: peopleAmount,
      isFullPayment: paymentType,
    });

    // Get BOG access token
    const accessToken = await getBOGAccessToken();

    // Clean and format tour description
    const cleanDescription = extractPlainText(bookingData.tourDescription);

    // Prepare BOG order request
    const bogOrderRequest = {
      callback_url: getCallbackUrl(),
      external_order_id,
      purchase_units: {
        currency: "GEL",
        total_amount: paymentAmount,
        basket: [
          {
            product_id: `TOUR_${uuidv4()}`,
            description: cleanDescription || tourName,
            quantity: peopleAmount,
            unit_price: Math.round(paymentAmount / peopleAmount),
            total_price: paymentAmount,
          },
        ],
      },
      redirect_urls: {
        success: `http://localhost:3000/payment-success?order_id=${external_order_id}`,
        fail: `http://localhost:3000/payment-failure?order_id=${external_order_id}`,
      },
      ttl: 30,
    };

    let bogOrderData: any;

    if (MOCK_MODE) {
      const mockOrderId = `mock_${uuidv4()}`;
      bogOrderData = {
        id: mockOrderId,
        _links: {
          details: { href: `${BOG_API_URL}/receipt/${mockOrderId}` },
          redirect: { href: `https://payment.bog.ge/?order_id=${mockOrderId}` },
        },
      };
      console.log("🧪 Mock payment created:", mockOrderId);
    } else {
      const bogResponse = await fetch(`${BOG_API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Accept-Language": "en",
          "Idempotency-Key": uuidv4(),
        },
        body: JSON.stringify(bogOrderRequest),
      });

      if (!bogResponse.ok) {
        const errorText = await bogResponse.text();
        console.error("❌ BOG API Error:", {
          status: bogResponse.status,
          statusText: bogResponse.statusText,
          body: errorText,
        });
        throw new Error(
          `BOG API error: ${bogResponse.statusText} - ${errorText}`
        );
      }

      bogOrderData = await bogResponse.json();
      console.log("✅ BOG payment created:", bogOrderData.id);
    }

    // Calculate remaining amount
    const calculatedRemainingAmount = paymentType
      ? null
      : totalTourPrice - paymentAmount;

    // Save to payment_orders table with simplified structure (removed unnecessary formatted fields)
    try {
      const insertQuery = `
        INSERT INTO payment_orders (
          customer_first_name, 
          customer_last_name, 
          customer_email, 
          customer_phone,
          people_amount, 
          selected_date, 
          tour_duration_days, 
          tour_duration_nights,
          tour_name,
          tour_description,
          start_location,
          end_location,
          locations,
          is_full_payment,
          total_tour_price,
          amount_paid,
          amount_remaining,
          external_order_id, 
          bog_order_id, 
          status,
          payment_url,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *;
      `;

      // Only include locations if they exist and are not empty
      const locationsToStore =
        bookingData.locations && bookingData.locations.length > 0
          ? JSON.stringify(bookingData.locations)
          : null;

      const values = [
        firstName,
        lastName,
        email,
        phone,
        peopleAmount,
        new Date(selectedDate),
        bookingData.tourDurationDays || 1,
        bookingData.tourDurationNights || 0,
        tourName,
        cleanDescription, // Use cleaned description
        bookingData.startLocation || null,
        bookingData.endLocation || null,
        locationsToStore,
        paymentType, // is_full_payment
        Number(totalTourPrice), // Ensure it's a number
        Number(paymentAmount), // Ensure it's a number
        calculatedRemainingAmount ? Number(calculatedRemainingAmount) : null, // Ensure it's a number or null
        external_order_id,
        bogOrderData.id,
        "pending",
        bogOrderData._links.redirect.href,
        new Date(Date.now() + 30 * 60 * 1000), // expires in 30 minutes
      ];

      const { rows } = await pool.query(insertQuery, values);
      console.log("✅ Payment order saved to database:", rows[0].id);
    } catch (dbError) {
      console.error("❌ Database error:", dbError);

      if (dbError instanceof Error) {
        console.error("❌ Error details:", dbError.message);
      }

      // Don't fail the payment creation if database save fails
      console.log("⚠️ Payment will continue despite database error");
    }

    // Return clean response with proper formatting
    res.status(201).json({
      success: true,
      orderId: bogOrderData.id,
      externalOrderId: external_order_id,
      paymentUrl: bogOrderData._links.redirect.href,
      detailsUrl: bogOrderData._links.details.href,
      amount: Number(paymentAmount),
      totalTourPrice: Number(totalTourPrice),
      remainingAmount: calculatedRemainingAmount
        ? Number(calculatedRemainingAmount)
        : null,
      currency: "GEL",
      status: "pending",
      expiresInMinutes: 30,
      createdAt: new Date().toISOString(),
      // Simplified booking info - no duplication
      booking: {
        tourName: tourName,
        customerName: `${firstName} ${lastName}`, // Single customer name field
        peopleAmount: peopleAmount,
        selectedDate: new Date(selectedDate).toISOString(), // Consistent date format
        paymentType: paymentType ? "full" : "reservation",
      },
    });
  } catch (error) {
    console.error("❌ Error creating BOG payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
