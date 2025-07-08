import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../../config/sql";
import { getBOGAccessToken } from "../payments/getBOGAccessToken";
import { BOG_API_URL, getCallbackUrl } from "../payments/payments";

interface TransferBookingData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  passengerCount: number;
  transferDate: Date;
  transferTime: Date;
  vehicleType: string;
  transferName: string;
  startLocation: string;
  endLocation: string;
  paymentAmount: number;
}

interface TransferPaymentRequest {
  bookingData: TransferBookingData;
}

export const handleTransferBOGPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { bookingData }: TransferPaymentRequest = req.body;

    if (!bookingData) {
      res.status(400).json({
        success: false,
        message: "Booking data is required",
      });
      return;
    }

    const {
      paymentAmount,
      firstName,
      lastName,
      email,
      phone,
      passengerCount,
      transferDate,
      transferTime,
      vehicleType,
      transferName,
      startLocation,
      endLocation,
    } = bookingData;

    // Validation
    if (!paymentAmount || paymentAmount <= 0) {
      res.status(400).json({
        success: false,
        message: "Payment amount is required and must be positive",
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

    if (!passengerCount || passengerCount <= 0) {
      res.status(400).json({
        success: false,
        message: "Passenger count is required and must be positive",
      });
      return;
    }

    if (!transferDate || !transferTime) {
      res.status(400).json({
        success: false,
        message: "Transfer date and time are required",
      });
      return;
    }

    if (!vehicleType || !transferName || !startLocation || !endLocation) {
      res.status(400).json({
        success: false,
        message:
          "Transfer information (vehicleType, transferName, startLocation, endLocation) is required",
      });
      return;
    }

    const external_order_id = `TRANSFER_ORDER_${uuidv4()}`;
    const accessToken = await getBOGAccessToken();

    const bogOrderRequest = {
      callback_url: getCallbackUrl(),
      external_order_id,
      purchase_units: {
        currency: "GEL",
        total_amount: paymentAmount,
        basket: [
          {
            product_id: `TRANSFER_${uuidv4()}`,
            description: `${transferName} - ${startLocation} to ${endLocation}`,
            quantity: passengerCount,
            unit_price: Math.round(paymentAmount / passengerCount),
            total_price: paymentAmount,
          },
        ],
      },
      redirect_urls: {
        success: `${process.env.FRONTEND_URL}/transfer/payment/success?order_id=${external_order_id}`,
        fail: `${process.env.FRONTEND_URL}/transfer/payment/failure?order_id=${external_order_id}`,
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
      throw new Error(
        `BOG API error: ${bogResponse.statusText} - ${errorText}`
      );
    }

    const bogOrderData = await bogResponse.json();

    const insertQuery = `
      INSERT INTO transfer_payment_orders (
        customer_first_name, 
        customer_last_name, 
        customer_email, 
        customer_phone,
        passenger_count, 
        transfer_date, 
        transfer_time, 
        vehicle_type,
        transfer_name,
        start_location,
        end_location,
        payment_amount,
        external_order_id, 
        bog_order_id, 
        status,
        payment_url,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *;
    `;

    const values = [
      firstName,
      lastName,
      email,
      phone,
      passengerCount,
      new Date(transferDate),
      new Date(transferTime),
      vehicleType,
      transferName,
      startLocation,
      endLocation,
      Number(paymentAmount),
      external_order_id,
      bogOrderData.id,
      "pending",
      bogOrderData._links.redirect.href,
      new Date(Date.now() + 30 * 60 * 1000), // 30 minutes expiry
    ];

    const result = await pool.query(insertQuery, values);

    res.status(201).json({
      success: true,
      orderId: bogOrderData.id,
      externalOrderId: external_order_id,
      paymentUrl: bogOrderData._links.redirect.href,
      detailsUrl: bogOrderData._links.details.href,
      amount: Number(paymentAmount),
      currency: "GEL",
      status: "pending",
      expiresInMinutes: 30,
      createdAt: new Date().toISOString(),
      booking: {
        transferName: transferName,
        customerName: `${firstName} ${lastName}`,
        passengerCount: passengerCount,
        transferDate: new Date(transferDate).toISOString(),
        transferTime: new Date(transferTime).toISOString(),
        vehicleType: vehicleType,
        route: `${startLocation} → ${endLocation}`,
      },
    });
  } catch (error) {
    console.error("Transfer BOG Payment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create transfer payment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
