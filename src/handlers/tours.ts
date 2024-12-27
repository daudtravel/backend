import { v4 as uuidv4 } from 'uuid';
import pool from '../config/sql';
import { Response, Request } from 'express';
import { CreateToursSchema } from '../schemas/tours/createToursSchema';
import { QueryParamsSchema } from '../schemas/tours/getToursSchema';
import { saveBase64Images } from '../utils/base64/convertBase64';
import { z } from 'zod';
import { UpdateToursSchema } from '../schemas/tours/updateToursSchema';
 

const QuerySchema = z.object({
  locale: z.string().min(2).max(5).optional()
});

const ParamsSchema = z.object({
  id: z.string().uuid()
});


export const createTour = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = CreateToursSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: 'Invalid input data',
        errors: result.error.format(),
      });
      return;
    }

    const { localizations, duration, total_price, reservation_price, image, gallery = [] } = result.data;

    const names = localizations.map(item => item.name);
    const checkQuery = `
      SELECT EXISTS (
        SELECT 1 FROM tours
        WHERE localizations @> ANY (
          SELECT jsonb_build_array(
            jsonb_build_object('name', name)
          )::jsonb
          FROM unnest($1::text[]) AS name
        )
      );
    `;

    const { rows: [{ exists: nameExists }] } = await pool.query(checkQuery, [names]);

    if (nameExists) {
      res.status(409).json({
        message: 'Tour with one of these names already exists',
      });
      return;
    }

    const tourId = uuidv4();
    const { mainImageUrl, galleryUrls } = await saveBase64Images(image, gallery);
    
    const createQuery = `
      INSERT INTO tours (
        id, 
        localizations, 
        duration, 
        total_price, 
        reservation_price, 
        image,
        gallery
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const values = [
      tourId,
      JSON.stringify(localizations),
      duration,
      total_price,
      reservation_price,
      mainImageUrl,
      galleryUrls,
    ];

    const { rows: [createdTour] } = await pool.query(createQuery, values);
    
    res.status(201).json({
      message: 'Tour created successfully',
      data: createdTour
    });

  } catch (error) {
    console.error('Error creating tour:', error);
    res.status(500).json({ 
      message: 'Internal server error while creating tour'
    });
  }
};

export const getAllTours = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = QueryParamsSchema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        message: 'Invalid query parameters',
        errors: result.error.format(),
      });
      return;
    }

    const { page, limit, sortBy, sortOrder, locale } = result.data;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        t.id,
        t.total_price,
        t.reservation_price,
        t.duration,
        t.image,
        t.created_at,
        t.updated_at,
        COUNT(*) OVER() as total_count,
        CASE 
          WHEN $1::text IS NOT NULL THEN (
            SELECT jsonb_agg(loc)
            FROM jsonb_array_elements(t.localizations) loc
            WHERE loc->>'locale' = $1
          )
          ELSE t.localizations
        END as localizations
      FROM tours t
    `;

    const queryParams: any[] = [locale || null];

    
    if (locale) {
      query += `
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements(t.localizations) loc
          WHERE loc->>'locale' = $1
        )
      `;
    }

     
    query += `
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${queryParams.length + 1}
      OFFSET $${queryParams.length + 2}
    `;
    queryParams.push(limit, offset);

    const { rows } = await pool.query(query, queryParams);

    if (rows.length === 0) {
      res.status(200).json({
        message: 'No tours found',
        data: {
          tours: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0
          }
        }
      });
      return;
    }

    const totalCount = parseInt(rows[0].total_count);
    const totalPages = Math.ceil(totalCount / limit);

    const tours = rows.map(tour => ({
      ...tour,
      localizations: tour.localizations || [],
      total_count: undefined
    }));

    res.status(200).json({
      message: 'Tours retrieved successfully',
      data: {
        tours,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages
        }
      }
    });

  } catch (error) {
    console.error('Error fetching tours:', error);
    res.status(500).json({
      message: 'Internal server error while fetching tours',
  
    });
  }
};

export const getTourById = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate route parameters
    const paramsResult = ParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({
        message: 'Invalid tour ID',
        errors: paramsResult.error.format()
      });
      return;
    }

  
    const queryResult = QuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({
        message: 'Invalid query parameters',
        errors: queryResult.error.format()
      });
      return;
    }

    const { id } = paramsResult.data;
    const { locale } = queryResult.data;

    let query = `
      SELECT 
        t.id,
        t.total_price,
        t.reservation_price,
        t.duration,
        t.image,
        t.gallery,
        t.created_at,
        t.updated_at,
        CASE 
          WHEN $2::text IS NOT NULL THEN (
            SELECT jsonb_agg(loc)
            FROM jsonb_array_elements(t.localizations) loc
            WHERE loc->>'locale' = $2
          )
          ELSE t.localizations
        END as localizations
      FROM tours t
      WHERE t.id = $1
    `;

    const { rows } = await pool.query(query, [id, locale || null]);

    if (rows.length === 0) {
      res.status(404).json({
        message: 'Tour not found',
        data: null
      });
      return;
    }

    const tour = {
      ...rows[0],
      localizations: rows[0].localizations || [],
      translations: (rows[0].localizations || []).reduce((acc: any, loc: any) => {
        acc[loc.locale] = {
          name: loc.name,
          destination: loc.destination,
          description: loc.description
        };
        return acc;
      }, {})
    };

    res.status(200).json({
      message: 'Tour retrieved successfully',
      data: {
        tour
      }
    });

  } catch (error) {
    console.error('Error fetching tour:', error);
    res.status(500).json({
      message: 'Internal server error while fetching tour',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

export const updateTour = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramsResult = ParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({
        message: 'Invalid tour ID',
        errors: paramsResult.error.format()
      });
      return;
    }

    const { id } = paramsResult.data;
    
    // Validate request body
    const result = UpdateToursSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: 'Invalid input data',
        errors: result.error.format(),
      });
      return;
    }

    const { 
      localizations, 
      duration, 
      total_price, 
      reservation_price, 
      image = null, 
      gallery = null,
      deleteImages = null
    } = result.data;

    // Check if the tour exists and get current data
    const checkQuery = `
      SELECT gallery, image 
      FROM tours 
      WHERE id = $1;
    `;
    
    const { rows: [tour] } = await pool.query(checkQuery, [id]);

    if (!tour) {
      res.status(404).json({
        message: 'Tour not found',
      });
      return;
    }

    // Process images based on what was provided
    let mainImageUrl = tour.image;  // Keep existing image by default
    let updatedGallery = tour.gallery || []; // Keep existing gallery by default

    // First handle image deletions if specified
    if (deleteImages !== null && deleteImages.length > 0) {
      updatedGallery = updatedGallery.filter(
        (imageUrl: string) => !deleteImages.includes(imageUrl)
      );
    }

    // Then handle new images if provided
    if (image !== null || gallery !== null) {
      let galleryUrls: string[] = [];
      
      if (image && gallery) {
        // Both image and gallery provided
        const processedImages = await saveBase64Images(image, gallery);
        mainImageUrl = processedImages.mainImageUrl;
        galleryUrls = processedImages.galleryUrls;
      } else if (image) {
        // Only main image provided
        const processedImages = await saveBase64Images(image, []);
        mainImageUrl = processedImages.mainImageUrl;
      } else if (gallery) {
        // Only gallery images provided
        const processedImages = await saveBase64Images(null, gallery);
        galleryUrls = processedImages.galleryUrls;
      }

      // Add new gallery images if provided
      if (gallery !== null) {
        updatedGallery = [...updatedGallery, ...galleryUrls];
      }
    }

    // Dynamically build the update query and values
    let updateFields = [
      'localizations = $2',
      'duration = $3',
      'total_price = $4',
      'reservation_price = $5',
      'updated_at = NOW()'
    ];
    
    let values = [
      id,
      JSON.stringify(localizations),
      duration,
      total_price,
      reservation_price,
    ];

    // Only include image in update if it was provided
    if (image !== null) {
      updateFields.push(`image = $${values.length + 1}`);
      values.push(mainImageUrl);
    }

    // Include gallery in update if either new gallery was provided or images were deleted
    if (gallery !== null || deleteImages !== null) {
      updateFields.push(`gallery = $${values.length + 1}`);
      values.push(updatedGallery);
    }

    const updateQuery = `
      UPDATE tours 
      SET ${updateFields.join(', ')}
      WHERE id = $1
      RETURNING *;
    `;

    const { rows: [updatedTour] } = await pool.query(updateQuery, values);

    res.status(200).json({
      message: 'Tour updated successfully',
      data: updatedTour
    });

  } catch (error) {
    console.error('Error updating tour:', error);
    res.status(500).json({
      message: 'Internal server error while updating tour'
    });
  }
};
 

export const deleteTour = async (req: Request, res: Response): Promise<void> => {
  try {
   
    const paramsResult = ParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({
        message: 'Invalid tour ID',
        errors: paramsResult.error.format()
      });
      return;
    }

    const { id } = paramsResult.data;

   
    const checkQuery = `
      SELECT EXISTS (
        SELECT 1 FROM tours WHERE id = $1
      ) AS exists;
    `;
    
    const { rows: [{ exists: tourExists }] } = await pool.query(checkQuery, [id]);

    if (!tourExists) {
      res.status(404).json({
        message: 'Tour not found',
      });
      return;
    }
 
    const deleteQuery = `
      DELETE FROM tours 
      WHERE id = $1
      RETURNING id;
    `;

    await pool.query(deleteQuery, [id]);

    res.status(200).json({
      message: 'Tour deleted successfully',
      data: { id }
    });

  } catch (error) {
    console.error('Error deleting tour:', error);
    res.status(500).json({ 
      message: 'Internal server error while deleting tour'
    });
  }
};

 