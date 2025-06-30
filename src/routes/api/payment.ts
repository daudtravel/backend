import { Router } from "express";

import { getBOGPaymentStatus } from "../../handlers/payments/handleBogPaymentStatus";
 
import { handleBOGCallbackImproved } from "../../handlers/payments/handleBogCallback";
import { createBOGPaymentWithCustomerData } from "../../handlers/payments/createBogPayment";

/**
 * 🎯 PURPOSE: This file defines the URL endpoints (routes) for payment operations
 *
 * WHAT IT DOES:
 * 1. Maps URLs to functions
 * 2. Defines which HTTP methods are allowed
 * 3. Organizes all payment-related endpoints in one place
 *
 * 🛣️ ROUTES DEFINED:
 * - POST /api/payments/bog/create     → createBOGPayment (customer creates payment)
 * - POST /api/payments/bog/callback   → handleBOGCallback (BOG sends results)
 * - GET  /api/payments/bog/status/:id → getBOGPaymentStatus (check payment status)
 */

const bogPaymentsRouter = Router();

// 💳 Create new payment
// URL: POST /api/payments/bog/create
// Called by: Your frontend when customer wants to pay
// Body: { amount: 25.50, currency: "GEL", description: "Premium service" }
// Returns: { success: true, payment_url: "https://payment.bog.ge/...", order_id: "abc123" }
bogPaymentsRouter.post("/payments/bog/create", createBOGPaymentWithCustomerData);

// 🔔 Handle payment results from BOG
// URL: POST /api/payments/bog/callback
// Called by: BOG's servers automatically after payment
// Body: { event: "order_payment", body: { order_id: "abc123", order_status: { key: "completed" } } }
// Returns: { success: true, message: "Callback processed" }
// ⚠️ IMPORTANT: This URL must be HTTPS and publicly accessible
bogPaymentsRouter.post("/payments/bog/callback", handleBOGCallbackImproved);

// 🔍 Check payment status
// URL: GET /api/payments/bog/status/abc123
// Called by: Your frontend, admin panel, or customer support
// Returns: { success: true, status: "completed", amount: { transferred: 25.50 } }
bogPaymentsRouter.get("/payments/bog/status/:order_id", getBOGPaymentStatus);

export default bogPaymentsRouter;

/**
 * 🔄 TYPICAL FLOW:
 *
 * 1. Customer clicks "Pay Now" on your website
 *    → Frontend calls POST /api/payments/bog/create
 *    → createBOGPayment function runs
 *    → Returns payment URL
 *
 * 2. Customer is redirected to BOG payment page
 *    → Customer enters card details
 *    → BOG processes payment
 *
 * 3. BOG sends result to your server
 *    → BOG calls POST /api/payments/bog/callback
 *    → handleBOGCallback function runs
 *    → Your system is updated
 *
 * 4. (Optional) Check payment status
 *    → Admin calls GET /api/payments/bog/status/abc123
 *    → getBOGPaymentStatus function runs
 *    → Returns current status
 *
 * 📝 NOTES:
 * - All routes are prefixed with /api (defined in your main router)
 * - Callback route must be publicly accessible (not behind authentication)
 * - Status route can be protected if needed
 */
