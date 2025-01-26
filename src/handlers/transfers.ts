import { Request, Response } from "express";
import { v4 as uuidv4 } from 'uuid';
import pool from "../config/sql";
import { CreateTransfersSchema } from "../schemas/transfers/createaTransferSchema";
import { EditTransferSchema } from "../schemas/transfers/editTrasnferSchema";
 
 

export const createTransfer = async (req: Request, res: Response): Promise<void> => {
    try {
      const requestData = {
        ...req.body,
        date: new Date(req.body.date).toISOString().split('T')[0]  
      };
  
      const result = CreateTransfersSchema.safeParse(requestData);

        if (!result.success) {
            res.status(400).json({
              message: 'Invalid input data',
              errors: result.error.format(),
            });
            return;
          }
          const { localizations, date, total_price, reservation_price } = result.data;
          const transfersId = uuidv4();
          const createQuery = `
            INSERT INTO transfers (
                id, 
                localizations, 
                date, 
                total_price, 
                reservation_price
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
            `;
        
            const values = [
                transfersId,
                JSON.stringify(localizations),
                date,
                total_price,
                reservation_price,
              ];
            
              const { rows: [createdTransfers]} = await pool.query(createQuery, values);
            
              res.status(201).json({
                message: 'Tour created successfully',
                data: createdTransfers
              });
    } catch (error) {
        console.error('Error creating transfers:', error);
        res.status(500).json({ 
          message: 'Internal server error while creating transfers'
        });
      
    }
  };

export const getAllTransfers = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = `SELECT * FROM transfers ORDER BY created_at DESC`;
    const { rows } = await pool.query(query);
    
    if (!rows || rows.length === 0) {
      res.status(200).json({
        message: 'No transfers found',
        data: []
      });
      return;
    }

    res.status(200).json({
      message: 'All transfers retrieved successfully',
      data: rows,
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

    res.status(200).json({
      message: `Transfer with ID: ${id} retrieved successfully`,
      data: rows[0],
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
      const { localizations, date, total_price, reservation_price } = result.data;
    
 
      const updateQuery = `
      UPDATE transfers
      SET
        localizations = $1,
        date = $2,
        total_price = $3,
        reservation_price = $4
      WHERE id = $5
      RETURNING *;
    `;
  
      const values = [
        JSON.stringify(localizations),
        date,
        total_price,
        reservation_price,
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