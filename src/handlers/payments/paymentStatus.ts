import type { Request, Response } from "express";
import { getBOGAccessToken } from "../payments/getBOGAccessToken";
import { BOG_API_URL } from "../payments/payments";

export const getBOGReceiptStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { order_id } = req.params;

    if (!order_id) {
      res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
      return;
    }

    console.log(`\n[BOG Receipt] ========== Starting Check ==========`);
    console.log(`[BOG Receipt] Original order_id from params: "${order_id}"`);
    console.log(`[BOG Receipt] Order ID length: ${order_id.length}`);
    
    // Try to detect if there's a prefix that shouldn't be there
    let cleanOrderId = order_id;
    if (order_id.startsWith('ORDER_')) {
      cleanOrderId = order_id.replace('ORDER_', '');
      console.log(`[BOG Receipt] ⚠️  Detected ORDER_ prefix, trying without it: "${cleanOrderId}"`);
    }

    const accessToken = await getBOGAccessToken();
    console.log(`[BOG Receipt] Access token obtained: ${accessToken.substring(0, 20)}...`);

    // Try with original ID first
    console.log(`[BOG Receipt] Calling API: ${BOG_API_URL}/receipt/${order_id}`);
    
    let response = await fetch(`${BOG_API_URL}/receipt/${order_id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    // If 404 and we detected a prefix, try without it
    if (!response.ok && response.status === 404 && cleanOrderId !== order_id) {
      console.log(`[BOG Receipt] First attempt failed (404), trying without ORDER_ prefix...`);
      console.log(`[BOG Receipt] Calling API: ${BOG_API_URL}/receipt/${cleanOrderId}`);
      
      response = await fetch(`${BOG_API_URL}/receipt/${cleanOrderId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
    }

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`\n[BOG Receipt] ❌ ORDER NOT FOUND IN BOG SYSTEM`);
        console.log(`[BOG Receipt] Tried order_id: "${order_id}"`);
        if (cleanOrderId !== order_id) {
          console.log(`[BOG Receipt] Also tried: "${cleanOrderId}"`);
        }
        console.log(`[BOG Receipt] Possible reasons:`);
        console.log(`  1. Payment link was never created successfully`);
        console.log(`  2. Wrong order ID stored in database`);
        console.log(`  3. Order ID format mismatch`);
        console.log(`[BOG Receipt] ⚠️  CHECK YOUR PAYMENT CREATION CODE!\n`);
        
        res.status(404).json({
          success: false,
          message: "Receipt not found in BOG system",
          order_id: order_id,
          attempted_ids: cleanOrderId !== order_id ? [order_id, cleanOrderId] : [order_id],
          suggestion: "Verify the order_id is correct when creating the payment"
        });
        return;
      }

      const errorText = await response.text();
      console.error(`[BOG Receipt] API Error for ${order_id}:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`BOG API error: ${response.statusText} - ${errorText}`);
    }

    const receipt = await response.json();

    // ===== DETAILED PAYMENT STATUS LOGGING =====
    console.log(`\n========== BOG Receipt Details ==========`);
    console.log(`✓ Order found in BOG system!`);
    console.log(`BOG Order ID: ${receipt.order_id}`);
    console.log(`External Order ID: ${receipt.external_order_id}`);
    console.log(`Status: ${receipt.order_status.key} - ${receipt.order_status.value}`);
    
    // Log payment amounts
    console.log(`\nAmounts:`);
    console.log(`  Requested: ${receipt.purchase_units.request_amount} ${receipt.purchase_units.currency_code}`);
    console.log(`  Transferred: ${receipt.purchase_units.transfer_amount} ${receipt.purchase_units.currency_code}`);
    console.log(`  Refunded: ${receipt.purchase_units.refund_amount} ${receipt.purchase_units.currency_code}`);

    // Log payment method details
    if (receipt.payment_detail) {
      console.log(`\nPayment Method: ${receipt.payment_detail.transfer_method.key}`);
      console.log(`Transaction ID: ${receipt.payment_detail.transaction_id}`);
    } else {
      console.log(`\n⚠️  Payment Detail: No payment details available (user may not have attempted payment yet)`);
    }

    // Log failure/rejection reason if exists
    if (receipt.reject_reason) {
      console.log(`\n🚨 REJECT REASON FOUND:`);
      console.log(`   ${JSON.stringify(receipt.reject_reason, null, 2)}`);
    }

    // Log buyer information
    if (receipt.buyer) {
      console.log(`\nBuyer Info:`);
      console.log(`  Full Name: ${receipt.buyer.full_name || 'N/A'}`);
      console.log(`  Mobile: ${receipt.buyer.mobile_number || 'N/A'}`);
    }

    // Log timestamps
    console.log(`\nTimestamps:`);
    console.log(`  Created: ${receipt.zoned_create_date}`);
    console.log(`  Expires: ${receipt.zoned_expire_date}`);

    // Check for common failure scenarios
    const successStatuses = ['COMPLETED', 'SUCCESS'];
    if (!successStatuses.includes(receipt.order_status.key)) {
      console.log(`\n❌ PAYMENT FAILED/INCOMPLETE`);
      console.log(`   Status: ${receipt.order_status.key}`);
      
      if (receipt.reject_reason) {
        console.log(`   Failure Reason: ${receipt.reject_reason}`);
      } else if (!receipt.payment_detail) {
        console.log(`   Likely Reason: User never completed payment (link expired or abandoned)`);
      } else {
        console.log(`   No specific reject_reason provided by BOG`);
      }
      
      // Log full receipt for debugging failed payments
      console.log(`\n   Full Receipt Data:`, JSON.stringify(receipt, null, 2));
    } else {
      console.log(`\n✅ PAYMENT SUCCESSFUL`);
    }

    console.log(`========== End Receipt Details ==========\n`);

    res.status(200).json({
      success: true,
      order_id: receipt.order_id,
      external_order_id: receipt.external_order_id,
      status: receipt.order_status.key,
      status_description: receipt.order_status.value,
      amount: {
        requested: parseFloat(receipt.purchase_units.request_amount),
        transferred: parseFloat(receipt.purchase_units.transfer_amount),
        refunded: parseFloat(receipt.purchase_units.refund_amount),
        currency: receipt.purchase_units.currency_code,
      },
      payment_method: receipt.payment_detail?.transfer_method.key,
      transaction_id: receipt.payment_detail?.transaction_id,
      created_at: receipt.zoned_create_date,
      expires_at: receipt.zoned_expire_date,
      buyer: receipt.buyer,
      reject_reason: receipt.reject_reason,
      full_details: receipt,
    });
  } catch (error) {
    console.error(`\n[BOG Receipt] ❌ FATAL ERROR:`, error);
    res.status(500).json({
      success: false,
      message: "Failed to get receipt status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};