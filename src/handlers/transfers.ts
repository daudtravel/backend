import { Request, Response } from "express";
import { v4 as uuidv4 } from 'uuid';
import pool from "../config/sql";
import { CreateTransfersSchema } from "../schemas/transfers/createaTransferSchema";
import { EditTransferSchema } from "../schemas/transfers/editTrasnferSchema";
import { z } from "zod";
 
const QueryParamsSchema = z.object({
  locale: z.string().optional(),
});


export const createTransfer = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = CreateTransfersSchema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({
        message: 'Invalid input data',
        errors: result.error.format(),
      });
      return;
    }
    
    const { localizations, prices } = result.data;
    const transfersId = uuidv4();
    
    const createQuery = `
      INSERT INTO transfers (
        id,
        localizations,
        prices,
        created_at
      )
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    
    const values = [
      transfersId,
      JSON.stringify(localizations),
      JSON.stringify(prices)
    ];
    
    const { rows: [createdTransfer] } = await pool.query(createQuery, values);
    
    res.status(201).json({
      message: 'Transfer created successfully',
      data: createdTransfer
    });
  } catch (error) {
    console.error('Error creating transfer:', error);
    res.status(500).json({
      message: 'Internal server error while creating transfer'
    });
  }
};

export const getAllTransfers = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = QueryParamsSchema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        message: 'Invalid query parameters',
        errors: result.error.format(),
      });
      return;
    }
    
    const { locale } = result.data;
    
    let query = `
      SELECT 
        t.*,
        CASE
          WHEN $1::text IS NOT NULL THEN (
            SELECT jsonb_agg(loc)
            FROM jsonb_array_elements(t.localizations) loc
            WHERE loc->>'locale' = $1
          )
          ELSE t.localizations
        END as filtered_localizations
      FROM transfers t
    `;
    
    const queryParams: any[] = [locale || null];
    
    // Add locale filter if specified
    if (locale) {
      query += `
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements(t.localizations) loc
          WHERE loc->>'locale' = $1
        )
      `;
    }
    
    const { rows } = await pool.query(query, queryParams);
    
    if (rows.length === 0) {
      res.status(200).json({
        message: 'No transfers found',
        data: []
      });
      return;
    }
    
    // Transform the response data
    const transfers = rows.map(transfer => ({
      id: transfer.id,
      localizations: transfer.filtered_localizations || [],
      prices: transfer.prices,
      created_at: transfer.created_at
    }));
    
    res.status(200).json({
      message: 'Transfers retrieved successfully',
      data: transfers
    });
  } catch (error) {
    console.error('Error fetching transfers:', error);
    res.status(500).json({
      message: 'Internal server error while fetching transfers',
    });
  }
};

export const getTransferById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    res.status(400).json({
      message: 'Transfer ID is required',
    });
    return;
  }

  try {
    const query = `SELECT * FROM transfers WHERE id = $1`;
    const { rows } = await pool.query(query, [id]);

    if (!rows || rows.length === 0) {
      res.status(404).json({
        message: `No transfer found with ID: ${id}`,
        data: null,
      });
      return;
    }

    // Format response to match the new structure
    const transfer = {
      id: rows[0].id,
      localizations: rows[0].localizations,
      prices: rows[0].prices,
      created_at: rows[0].created_at
    };

    res.status(200).json({
      message: `Transfer with ID: ${id} retrieved successfully`,
      data: transfer
    });
  } catch (error) {
    console.error('Error fetching transfer by ID:', error);
    res.status(500).json({
      message: 'Internal server error while fetching the transfer',
    });
  }
};

export const updateTransfer = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = EditTransferSchema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({
        message: 'Invalid input data',
        errors: result.error.format(),
      });
      return;
    }
    
    const { id } = req.params;
    const { localizations, prices } = result.data;
    
    const updateQuery = `
      UPDATE transfers
      SET
        localizations = $1,
        prices = $2
      WHERE id = $3
      RETURNING *;
    `;
    
    const values = [
      JSON.stringify(localizations),
      JSON.stringify(prices),
      id,
    ];
    
    const { rows } = await pool.query(updateQuery, values);
    
    if (rows.length === 0) {
      res.status(404).json({
        message: `Transfer with ID ${id} not found`,
      });
      return;
    }
    
    res.status(200).json({
      message: 'Transfer updated successfully',
      data: rows[0],
    });
  } catch (error) {
    console.error('Error updating transfer:', error);
    res.status(500).json({
      message: 'Internal server error while updating transfer',
    });
  }
};

export const deleteTransfer = async (req: Request, res: Response): Promise<void> => {
    try {

      const { id } = req.params;
      console.log(id)
      const deleteQuery = `
        DELETE FROM transfers
        WHERE id = $1
        RETURNING *;
      `;

      const { rows } = await pool.query(deleteQuery, [id]);

      if (rows.length === 0) {
        res.status(404).json({
          message: `Transfer with ID ${id} not found`,
        });
        return;
      }

      res.status(200).json({
        message: 'Transfer deleted successfully',
        data: rows[0],
      });
    } catch (error) {
      console.error('Error deleting transfer:', error);
      res.status(500).json({
        message: 'Internal server error while deleting transfer',
      });
    }
  };