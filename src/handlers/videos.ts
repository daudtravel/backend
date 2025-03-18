import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from "express";
import pool from '../config/sql';
import { VideoSchema } from '../schemas/videos/createVideoSchema';
 


export const createVideo = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = VideoSchema.safeParse(req.body);
      
      if (!result.success) {
        res.status(400).json({
          message: 'Invalid input data',
          errors: result.error.format(),
        });
        return;
      }
      
      const { youtube_link, title, description } = result.data;
      const videoId = uuidv4();
      
      const createQuery = `
        INSERT INTO videos (
          id,
          youtube_link,
          title,
          description,
          created_at
        )
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING *;
      `;
      
      const values = [
        videoId,
        youtube_link,
        title,
        description || null,
      ];
      
      const { rows: [createdVideo] } = await pool.query(createQuery, values);
      
      res.status(201).json({
        message: 'Video created successfully',
        data: createdVideo
      });
    } catch (error) {
      console.error('Error creating video:', error);
      res.status(500).json({
        message: 'Internal server error while creating video'
      });
    }
  };
  
   
  export const getAllVideos = async (req: Request, res: Response): Promise<void> => {
    try {
      const videosQuery = `
        SELECT *
        FROM videos
        ORDER BY created_at DESC;
      `;
      
      const { rows: videos } = await pool.query(videosQuery);
      
      res.status(200).json({
        message: 'Videos retrieved successfully',
        data: videos
      });
    } catch (error) {
      console.error('Error retrieving videos:', error);
      res.status(500).json({
        message: 'Internal server error while retrieving videos'
      });
    }
  };
  
 
  export const deleteVideo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      const deleteQuery = `
        DELETE FROM videos
        WHERE id = $1
        RETURNING id;
      `;
      
      const { rows } = await pool.query(deleteQuery, [id]);
      
      if (rows.length === 0) {
        res.status(404).json({
          message: `Video with ID ${id} not found`
        });
        return;
      }
      
      res.status(200).json({
        message: 'Video deleted successfully',
        data: { id: rows[0].id }
      });
    } catch (error) {
      console.error('Error deleting video:', error);
      res.status(500).json({
        message: 'Internal server error while deleting video'
      });
    }
  };