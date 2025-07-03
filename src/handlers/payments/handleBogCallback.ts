import type { Request, Response } from "express";
import { getBOGAccessToken } from "./getBOGAccessToken";
import { BOG_API_URL, MOCK_MODE } from "./payments";
import { saveBookingAfterPayment } from "./handleBOGPayment";

export const handleBOGCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { order_id, external_order_id, status } = req.body;

    console.log("📞 BOG Callback received:", {
      order_id,
      external_order_id,
      status,
    });

    if (!order_id || !external_order_id) {
      res.status(400).json({
        success: false,
        message: "Missing required callback data",
      });
      return;
    }

    let paymentDetails;

    if (MOCK_MODE) {
      paymentDetails = {
        order_id: order_id,
        external_order_id: external_order_id,
        order_status: { key: "completed", value: "Completed" },
        payment_detail: {
          transaction_id: `mock_transaction_${Date.now()}`,
          transfer_method: { key: "card", value: "Card Payment" },
          code: "100",
          code_description: "Successful payment",
        },
      };
    } else {
      const accessToken = await getBOGAccessToken();

      const response = await fetch(`${BOG_API_URL}/receipt/${order_id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to get payment details: ${response.statusText}`
        );
      }

      paymentDetails = await response.json();
    }

    if (paymentDetails.order_status.key === "completed") {
      try {
        await saveBookingAfterPayment(external_order_id, paymentDetails);
      } catch (error) {
        console.error(
          `❌ Error saving booking after successful payment:`,
          error
        );
      }
    } else {
      console.log(
        `❌ Payment not successful for order: ${external_order_id}, status: ${paymentDetails.order_status.key}`
      );
    }

    res.status(200).json({
      success: true,
      message: "Callback processed",
      order_id: order_id,
      external_order_id: external_order_id,
      status: paymentDetails.order_status.key,
    });
  } catch (error) {
    console.error("❌ Error processing BOG callback:", error);
    res.status(200).json({
      success: true,
      message: "Callback received but processing failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
