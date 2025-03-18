import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from "express";
import pool from '../config/sql';
import { CreateFaqSchema } from '../schemas/faq/createFaqSchema';
import { UpdateFaqSchema } from '../schemas/faq/editFaqSchema';
 
 

export const createFAQ = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = CreateFaqSchema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({
        message: 'Invalid input data',
        errors: result.error.format(),
      });
      return;
    }
    
    const { localizations } = result.data;
    const faqId = uuidv4();
    
    const createQuery = `
      INSERT INTO faq (
        id,
        localizations
       
      )
      VALUES ($1, $2 )
      RETURNING *;
    `;
    
    const values = [
      faqId,
      JSON.stringify(localizations),
    ];
    
    const { rows: [createdFAQ] } = await pool.query(createQuery, values);
    
    res.status(201).json({
      message: 'FAQ created successfully',
      data: createdFAQ
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({
      message: 'Internal server error while creating FAQ'
    });
  }
};

export const updateFAQ = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = UpdateFaqSchema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({
        message: 'Invalid input data',
        errors: result.error.format(),
      });
      return;
    }
    
    const { id } = req.params;
    const { localizations } = result.data;
    
    const updateQuery = `
    UPDATE faq
    SET localizations = $1
    WHERE id = $2
    RETURNING *;
  `;
    
    const values = [
      JSON.stringify(localizations),
      id,
    ];
    
    const { rows } = await pool.query(updateQuery, values);
    
    if (rows.length === 0) {
      res.status(404).json({
        message: `FAQ with ID ${id} not found`,
      });
      return;
    }
    
    res.status(200).json({
      message: 'FAQ updated successfully',
      data: rows[0],
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    res.status(500).json({
      message: 'Internal server error while updating FAQ',
    });
  }
};



 
export const getAllfaq = async (req: Request, res: Response): Promise<void> => {
    try {
      const faqQuery = `
        SELECT *
        FROM faq
      `;
      
      const { rows: faq } = await pool.query(faqQuery);
      
      res.status(200).json({
        message: 'faq retrieved successfully',
        data: faq
      });
    } catch (error) {
      console.error('Error retrieving faq:', error);
      res.status(500).json({
        message: 'Internal server error while retrieving faq'
      });
    }
  };

export const getFaqById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
       
      if (!id) {
        res.status(400).json({
          message: 'FAQ ID is required'
        });
        return;
      }
      
      const faqQuery = `
        SELECT *
        FROM faq
        WHERE id = $1
      `;
      
      const { rows: faq } = await pool.query(faqQuery, [id]);
      
     
      if (faq.length === 0) {
        res.status(404).json({
          message: 'FAQ not found'
        });
        return;
      }
      
      res.status(200).json({
        message: 'FAQ retrieved successfully',
        data: faq[0]
      });
    } catch (error) {
      console.error('Error retrieving FAQ by ID:', error);
      res.status(500).json({
        message: 'Internal server error while retrieving FAQ'
      });
    }
  };


export const deleteFAQ = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      const deleteQuery = `
        DELETE FROM faq
        WHERE id = $1
        RETURNING id;
      `;
      
      const { rows } = await pool.query(deleteQuery, [id]);
      
      if (rows.length === 0) {
        res.status(404).json({
          message: `FAQ with ID ${id} not found`
        });
        return;
      }
      
      res.status(200).json({
        message: 'FAQ deleted successfully',
        data: { id: rows[0].id }
      });
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      res.status(500).json({
        message: 'Internal server error while deleting FAQ'
      });
    }
  };