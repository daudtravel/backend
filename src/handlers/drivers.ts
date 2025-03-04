import pool from "../config/sql";
import { v4 as uuidv4 } from 'uuid';
import { saveBase64Images } from "../utils/base64/saveBase64";
import { Request, Response } from "express";
import CreateDriversSchema from "../schemas/transfers/createDriversSchema";
 
 
export const addDriver = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = CreateDriversSchema.safeParse(req.body);

        if (!result.success) {
            res.status(400).json({
                message: "Invalid input data",
                errors: result.error.format(),
            });
            return;
        }

        const { firstname, lastname, image } = result.data;
        const driverID = uuidv4();
        const { mainImageUrl } = await saveBase64Images(image);

        const createQuery = `
            INSERT INTO drivers (
                id, firstname, lastname, image
            ) VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;

        const values = [driverID, firstname, lastname, mainImageUrl];

        const { rows: [createdDriver] } = await pool.query(createQuery, values);

        res.status(201).json({
            message: "Driver created successfully",
            data: createdDriver,
        });
    } catch (error) {
        console.error("Error creating driver:", error);
        res.status(500).json({
            message: "Internal server error while creating driver",
        });
    }
};

export const getAllDrivers = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = `SELECT id, firstname, lastname, image FROM drivers`;
      const { rows: drivers } = await pool.query(query);
  
      res.json({
        message: "Drivers retrieved successfully",
        count: drivers.length,
        data: drivers,
      });
    } catch (error) {
      console.error("Error retrieving drivers:", error);
      res.status(500).json({
        message: "Internal server error while retrieving drivers",
      });
    }
  };

export const deleteDriver = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({
                message: 'Driver ID is required'
            });
            return;
        }

        const deleteQuery = `
            DELETE FROM drivers 
            WHERE id = $1 
            RETURNING *;
        `;

        const { rows } = await pool.query(deleteQuery, [id]);

        if (rows.length === 0) {
            res.status(404).json({
                message: 'Driver not found'
            });
            return;
        }

        res.status(200).json({
            message: 'Driver deleted successfully',
            data: rows[0]
        });
    } catch (error) {
        console.error('Error deleting driver:', error);
        res.status(500).json({
            message: 'Internal server error while deleting driver'
        });
    }
};