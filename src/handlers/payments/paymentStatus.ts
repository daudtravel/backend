import type { Request, Response } from "express";
import { getBOGAccessToken } from "../payments/getBOGAccessToken";
import { BOG_API_URL } from "../payments/payments";

export const createBOGPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { amount, external_order_id, callback_url, redirect_url } = req.body;

    console.log(`\n[BOG Payment] ========== Creating Payment ==========`);
    console.log(`[BOG Payment] Amount: ${amount}`);
    console.log(`[BOG Payment] External Order ID: ${external_order_id}`);

    const accessToken = await getBOGAccessToken();

    // Your payment creation request
    const requestBody = {
      callback_url: callback_url,
      external_order_id: external_order_id,
      purchase_units: {
        currency: "GEL",
        total_amount: amount,
        basket: [
          {
            quantity: 1,
            unit_price: amount,
            product_id: external_order_id,
          },
        ],
      },
      redirect_url: redirect_url,
    };

    console.log(
      `[BOG Payment] Request body:`,
      JSON.stringify(requestBody, null, 2)
    );
    console.log(`[BOG Payment] Calling: ${BOG_API_URL}/orders`);

    const response = await fetch(`${BOG_API_URL}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`[BOG Payment] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BOG Payment] ❌ PAYMENT CREATION FAILED!`);
      console.error(`[BOG Payment] Status: ${response.status}`);
      console.error(`[BOG Payment] Error: ${errorText}`);

      throw new Error(`BOG API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    console.log(`\n[BOG Payment] ✅ PAYMENT CREATED SUCCESSFULLY!`);
    console.log(`[BOG Payment] BOG Order ID: ${data.order_id}`);
    console.log(`[BOG Payment] Payment Link: ${data._links.redirect.href}`);
    console.log(`[BOG Payment] Details Link: ${data._links.details.href}`);
    console.log(`[BOG Payment] Full response:`, JSON.stringify(data, null, 2));

    // CRITICAL: Store the EXACT order_id that BOG returns
    // Do NOT add any prefix like "ORDER_"
    const bogOrderId = data.order_id; // This is what you must save!

    console.log(
      `\n[BOG Payment] ⚠️  IMPORTANT: Save this exact order_id: "${bogOrderId}"`
    );
    console.log(`[BOG Payment] Do NOT modify or add prefix to this ID!`);

    // TODO: Save bogOrderId to your database here
    // await Order.findByIdAndUpdate(your_order_id, {
    //   bogOrderId: bogOrderId,
    //   paymentLink: data._links.redirect.href,
    //   paymentStatus: 'PENDING'
    // });

    console.log(`[BOG Payment] ========== End Payment Creation ==========\n`);

    res.status(200).json({
      success: true,
      order_id: data.order_id, // Return the exact BOG order_id
      payment_link: data._links.redirect.href,
      details_link: data._links.details.href,
      external_order_id: external_order_id,
    });
  } catch (error) {
    console.error(`[BOG Payment] ❌ FATAL ERROR:`, error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
