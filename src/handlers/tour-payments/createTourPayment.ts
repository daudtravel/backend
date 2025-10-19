import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getBOGAccessToken } from "../payments/getBOGAccessToken";
import { BOG_API_URL, getCallbackUrl } from "../payments/payments";
import pool from "../../config/sql";

interface BookingData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  peopleAmount: number;
  selectedDate: Date;
  tourDurationDays?: number;
  tourDurationNights?: number;
  paymentType: boolean;
  paymentAmount: number;
  totalTourPrice: number;
  remainingAmount?: number;
  tourName: string;
  tourDescription?: string;
  startLocation?: string;
  endLocation?: string;
  locations?: string[];
}

interface PaymentRequest {
  bookingData: BookingData;
}

const extractPlainText = (description: string | undefined): string | null => {
  if (!description) return null;

  try {
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
    return description.trim() || null;
  }
};

export const handleBOGPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { bookingData }: PaymentRequest = req.body;

    if (!bookingData) {
      res.status(400).json({
        success: false,
        message: "Booking data is required",
      });
      return;
    }

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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ✅ VALIDATION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

    if (!paymentType && (!remainingAmount || remainingAmount <= 0)) {
      res.status(400).json({
        success: false,
        message: "Remaining amount is required for reservation payments",
      });
      return;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📝 PREPARE ORDER DATA
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const external_order_id = `ORDER_${uuidv4()}`;
    const accessToken = await getBOGAccessToken();
    const cleanDescription = extractPlainText(bookingData.tourDescription);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📤 CREATING BOG TOUR PAYMENT ORDER");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📌 External Order ID: ${external_order_id}`);
    console.log(`🎫 Tour: ${tourName}`);
    console.log(`👥 People: ${peopleAmount}`);
    console.log(
      `💰 Payment: ${paymentAmount} GEL (${paymentType ? "Full" : "Reservation"})`
    );
    console.log(`📧 Customer: ${email}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔧 CREATE BOG ORDER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const bogOrderRequest = {
      callback_url: getCallbackUrl(),
      external_order_id,
      purchase_units: {
        currency: "GEL",
        total_amount: paymentAmount,
        basket: [
          {
            product_id: `TOUR_${uuidv4()}`,
            description: tourName,
            quantity: peopleAmount,
            unit_price: Math.round(paymentAmount / peopleAmount),
            total_price: paymentAmount,
          },
        ],
      },
      // ✅ SOLUTION: Use external_order_id in redirect URLs
      // Frontend will look up BOG's order_id from database using this
      redirect_urls: {
        success: `${process.env.FRONTEND_URL}/payment/success?order_id=${external_order_id}`,
        fail: `${process.env.FRONTEND_URL}/payment/failure?order_id=${external_order_id}`,
      },
      buyer: {
        full_name: `${firstName} ${lastName}`,
        masked_email: email,
        masked_phone: phone,
      },
      ttl: 30,
    };

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
      console.error("❌ BOG API Error:", errorText);
      throw new Error(
        `BOG API error: ${bogResponse.statusText} - ${errorText}`
      );
    }

    const bogOrderData = await bogResponse.json();
    const bogOrderId = bogOrderData.id;
    const paymentUrl = bogOrderData._links.redirect.href;

    console.log("✅ BOG Order Created Successfully!");
    console.log(`🆔 BOG Order ID: ${bogOrderId}`);
    console.log(`📌 External Order ID: ${external_order_id}`);
    console.log(`🔗 Payment URL: ${paymentUrl}\n`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 💾 SAVE TO DATABASE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const calculatedRemainingAmount = paymentType
      ? null
      : totalTourPrice - paymentAmount;

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
      cleanDescription,
      bookingData.startLocation || null,
      bookingData.endLocation || null,
      locationsToStore,
      paymentType,
      Number(totalTourPrice),
      Number(paymentAmount),
      calculatedRemainingAmount ? Number(calculatedRemainingAmount) : null,
      external_order_id,
      bogOrderId,
      "pending",
      paymentUrl,
      new Date(Date.now() + 30 * 60 * 1000),
    ];

    const { rows } = await pool.query(insertQuery, values);
    console.log(`💾 Payment order saved to database (ID: ${rows[0].id})\n`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ✅ RETURN RESPONSE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    res.status(201).json({
      success: true,
      orderId: bogOrderId,
      externalOrderId: external_order_id,
      paymentUrl: paymentUrl,
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
      booking: {
        tourName: tourName,
        customerName: `${firstName} ${lastName}`,
        peopleAmount: peopleAmount,
        selectedDate: new Date(selectedDate).toISOString(),
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
