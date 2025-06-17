import type { Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"
import { BOG_API_URL, getCallbackUrl, MOCK_MODE } from "../payments"
import pool from "../../config/sql"
import { getBOGAccessToken } from "./getBOGAccessToken"


export const createBOGPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      amount,
      currency = "USD",
      external_order_id,
      items = [],
      customer_info,
      success_url,
      fail_url,
      metadata,
    } = req.body

 
    if (!amount || !external_order_id) {
      res.status(400).json({
        message: "Missing required fields: amount, external_order_id",
      })
      return
    }
 
    const accessToken = await getBOGAccessToken()

    const bogOrderRequest = {
      callback_url: getCallbackUrl(),
      external_order_id,
      purchase_units: {
        currency: currency.toUpperCase(),
        total_amount: amount,
        basket: items.map((item: any) => ({
          product_id: item.product_id || item.id || uuidv4(),
          description: item.description || item.name,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || item.price || amount,
        })),
      },
      redirect_urls: {
        success: success_url || `${process.env.BASE_URL}/payment-success`,
        fail: fail_url ,
      },
      buyer: customer_info
        ? {
            full_name: customer_info.full_name,
            masked_email: customer_info.email,
            masked_phone: customer_info.phone,
          }
        : undefined,
      ttl: 30, // 30 minutes expiry
    }



 

    let bogOrderData: any

    if (MOCK_MODE) {
    
      const mockOrderId = `mock_${uuidv4()}`
      bogOrderData = {
        id: mockOrderId,
        _links: {
          details: { href: `https://api.bog.ge/payments/v1/receipt/${mockOrderId}` },
          redirect: { href: `https://payment.bog.ge/?order_id=${mockOrderId}` },
        },
      }
    } else {
      // Real BOG API call
      const bogResponse = await fetch(`${BOG_API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Accept-Language": "en",
        },
        body: JSON.stringify(bogOrderRequest),
      })

      if (!bogResponse.ok) {
        const errorText = await bogResponse.text()
        throw new Error(`BOG API error: ${bogResponse.statusText} - ${errorText}`)
      }

      bogOrderData = await bogResponse.json()


      


 

       
    }

    // Save payment order to database with tour booking details
    const insertQuery = `
      INSERT INTO payment_orders (
        order_id,
        external_order_id,
        customer_email,
        customer_name,
        customer_phone,
        total_amount,
        currency,
        status,
        items,
        redirect_url,
        booking_metadata,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      RETURNING *;
    `

    const values = [
      bogOrderData.id,
      external_order_id,
      customer_info?.email || null,
      customer_info?.full_name || null,
      customer_info?.phone || null,
      amount,
      currency.toUpperCase(),
      "pending",
      JSON.stringify(items),
      bogOrderData._links.redirect.href,
      JSON.stringify(metadata || {}), // Store tour booking details
    ]

    const {
      rows: [paymentOrder],
    } = await pool.query(insertQuery, values)

    res.status(201).json({
      message: "Payment order created successfully",
      data: {
        order_id: bogOrderData.id,
        payment_url: bogOrderData._links.redirect.href,
        details_url: bogOrderData._links.details.href,
        order: paymentOrder,
      },
    })


    
  } catch (error) {
    console.error("Error creating BOG payment:", error)
    res.status(500).json({
      message: "Internal server error while creating payment",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}