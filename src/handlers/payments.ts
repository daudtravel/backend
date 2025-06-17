import type { Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"
import pool from "../config/sql"
import crypto from "crypto"
import { getBOGAccessToken } from "./payments/getBOGAccessToken"



export const BOG_AUTH_URL = "https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token"
export const BOG_API_URL = "https://api.bog.ge/payments/v1/ecommerce"

export const MOCK_MODE = process.env.NODE_ENV === "development" && !process.env.BOG_CLIENT_ID



const BOG_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4RUyAw3+CdkS3ZNILQh
zHI9Hemo+vKB9U2BSabppkKjzjjkf+0Sm76hSMiu/HFtYhqWOESryoCDJoqffY0Q
1VNt25aTxbj068QNUtnxQ7KQVLA+pG0smf+EBWlS1vBEAFbIas9d8c9b9sSEkTrr
TYQ90WIM8bGB6S/KLVoT1a7SnzabjoLc5Qf/SLDG5fu8dH8zckyeYKdRKSBJKvhx
tcBuHV4f7qsynQT+f2UYbESX/TLHwT5qFWZDHZ0YUOUIvb8n7JujVSGZO9/+ll/g
4ZIWhC1MlJgPObDwRkRd8NFOopgxMcMsDIZIoLbWKhHVq67hdbwpAq9K9WMmEhPn
PwIDAQAB
-----END PUBLIC KEY-----`


export const getCallbackUrl = (): string => {
  if (process.env.NODE_ENV === "production") {
    return `${process.env.BASE_URL}/api/payments/bog-callback`
  }
  return process.env.BOG_CALLBACK_URL || "https://webhook.site/unique-id-here"
}


export const getMockBOGToken = (): string => {
  return "mock_token_for_development"
}

const verifyBOGSignature = (body: string, signature: string): boolean => {
  try {
    const verifier = crypto.createVerify("SHA256")
    verifier.update(body)
    return verifier.verify(BOG_PUBLIC_KEY, signature, "base64")
  } catch (error) {
    console.error("Signature verification error:", error)
    return false
  }
}

// const handleBOGCallback = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const signature = req.headers["callback-signature"] as string
//     const body = JSON.stringify(req.body)

//     // Verify signature if provided
//     if (signature && !verifyBOGSignature(body, signature)) {
//       console.error("Invalid BOG callback signature")
//       res.status(400).json({ message: "Invalid signature" })
//       return
//     }

//     const { event, body: callbackData } = req.body

//     if (event !== "order_payment") {
//       res.status(400).json({ message: "Invalid event type" })
//       return
//     }

//     const { order_id, order_status, payment_detail } = callbackData

//     // Map BOG status to our status
//     let status = "pending"
//     switch (order_status?.key) {
//       case "completed":
//         status = "success"
//         break
//       case "rejected":
//         status = "failed"
//         break
//       case "refunded":
//       case "refunded_partially":
//         status = "refunded"
//         break
//       default:
//         status = "pending"
//     }

//     // Update payment status in database
//     const updateQuery = `
//       UPDATE payment_orders 
//       SET status = $1, 
//           callback_data = $2, 
//           updated_at = CURRENT_TIMESTAMP
//       WHERE order_id = $3
//       RETURNING *;
//     `

//     const values = [status, JSON.stringify(callbackData), order_id]
//     const {
//       rows: [updatedOrder],
//     } = await pool.query(updateQuery, values)

//     if (!updatedOrder) {
//       console.error(`Order not found: ${order_id}`)
//       res.status(404).json({ message: "Order not found" })
//       return
//     }

//     console.log(`Payment status updated: ${order_id} -> ${status}`)

//     // If payment is successful and it's a tour booking, you can trigger additional actions
//     if (status === "success" && updatedOrder.booking_metadata) {
//       const bookingData = JSON.parse(updatedOrder.booking_metadata)
//       if (bookingData.booking_type === "tour") {
//         // Here you can:
//         // 1. Send confirmation email to customer
//         // 2. Create tour booking record
//         // 3. Send notification to tour operators
//         // 4. Update tour availability
//         console.log("Tour booking confirmed:", bookingData.tour_booking)
//       }
//     }

//     // Return 200 to confirm callback receipt
//     res.status(200).json({ message: "Callback processed successfully" })
//   } catch (error) {
//     console.error("Error processing BOG callback:", error)
//     res.status(500).json({ message: "Internal server error" })
//   }
// }

// export const getBOGPaymentStatus = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { order_id } = req.params

//     const dbQuery = `
//       SELECT * FROM payment_orders 
//       WHERE order_id = $1 OR external_order_id = $1;
//     `
//     const { rows } = await pool.query(dbQuery, [order_id])

//     if (rows.length === 0) {
//       res.status(404).json({ message: "Payment order not found" })
//       return
//     }

//     const paymentOrder = rows[0]

//     // Get fresh status from BOG API
//     try {
//       const accessToken = await getBOGAccessToken()
//       const bogResponse = await fetch(`${BOG_API_URL}/receipt/${paymentOrder.order_id}`, {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//         },
//       })

//       if (bogResponse.ok) {
//         const bogData = await bogResponse.json()

//         // Update status if different
//         let status = "pending"
//         switch (bogData.order_status?.key) {
//           case "completed":
//             status = "success"
//             break
//           case "rejected":
//             status = "failed"
//             break
//           case "refunded":
//           case "refunded_partially":
//             status = "refunded"
//             break
//         }

//         if (status !== paymentOrder.status) {
//           const updateQuery = `
//             UPDATE payment_orders 
//             SET status = $1, callback_data = $2, updated_at = CURRENT_TIMESTAMP
//             WHERE order_id = $3
//             RETURNING *;
//           `
//           const {
//             rows: [updated],
//           } = await pool.query(updateQuery, [status, JSON.stringify(bogData), paymentOrder.order_id])

//           res.json({
//             message: "Payment status retrieved and updated",
//             data: { ...updated, bog_details: bogData },
//           })
//           return
//         }
//       }
//     } catch (bogError) {
//       console.error("Error fetching from BOG API:", bogError)
//       // Continue with database data if BOG API fails
//     }

//     res.json({
//       message: "Payment status retrieved",
//       data: paymentOrder,
//     })
//   } catch (error) {
//     console.error("Error retrieving payment status:", error)
//     res.status(500).json({ message: "Internal server error" })
//   }
// }
