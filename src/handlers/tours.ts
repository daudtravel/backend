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
      console.log('Validation errors:', result.error.format());
      res.status(400).json({
        message: 'Invalid input data',
        errors: result.error.format(),
      });
      return;
    }

    const { localizations, duration, prices, image, gallery = [] } = result.data;

   
    const validatePrices = (prices: any): boolean => {
      const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
      return months.every(month => 
        prices[month] && 
        typeof prices[month].total_price === 'number' && 
        typeof prices[month].reservation_price === 'number'
      );
    };

    if (!validatePrices(prices)) {
      res.status(400).json({
        message: 'Invalid prices structure. Must include total_price and reservation_price for months 1-12'
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
        prices,
        image,
        gallery
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const values = [
      tourId,
      JSON.stringify(localizations),
      duration,
      JSON.stringify(prices),
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
    const { page = 1, limit = 10, locale } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        t.id,
        t.prices,
        t.duration,
        t.image,
        t.gallery,
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

    // Simple sort by updated_at
    query += `
      ORDER BY updated_at DESC
      LIMIT $${queryParams.length + 1}
      OFFSET $${queryParams.length + 2}
    `;
    queryParams.push(Number(limit), offset);

    const { rows } = await pool.query(query, queryParams);

    if (rows.length === 0) {
      res.status(200).json({
        message: 'No tours found',
        data: {
          tours: [],
          pagination: {
            total: 0,
            page: Number(page),
            limit: Number(limit),
            totalPages: 0
          }
        }
      });
      return;
    }

    const totalCount = parseInt(rows[0].total_count);
    const totalPages = Math.ceil(totalCount / Number(limit));

    const tours = rows.map(tour => {
      const currentMonth = (new Date().getMonth() + 1).toString();
      const currentPrices = tour.prices[currentMonth] || {
        total_price: 0,
        reservation_price: 0
      };

      return {
        ...tour,
        total_price: currentPrices.total_price,
        reservation_price: currentPrices.reservation_price,
        localizations: tour.localizations || [],
        total_count: undefined
      };
    });

    res.status(200).json({
      message: 'Tours retrieved successfully',
      data: {
        tours,
        pagination: {
          total: totalCount,
          page: Number(page),
          limit: Number(limit),
          totalPages
        }
      }
    });

  } catch (error) {
    console.error('Error fetching tours:', error);
    res.status(500).json({
      message: 'Internal server error while fetching tours'
    });
  }
};


export const getPublicTours = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, locale, minPrice, maxPrice } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const currentMonth = (new Date().getMonth() + 1).toString();

    let query = `
      SELECT 
        t.id,
        t.prices,
        t.duration,
        t.image,
        t.gallery,
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
      WHERE t.public = true
    `;

    const queryParams: any[] = [locale || null];

    if (locale) {
      query += `
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(t.localizations) loc
          WHERE loc->>'locale' = $1
        )
      `;
    }


    if (minPrice !== undefined) {
      queryParams.push(minPrice);
      query += `
        AND (prices->>'${currentMonth}')::jsonb->>'total_price'::numeric >= $${queryParams.length}
      `;
    }

    if (maxPrice !== undefined) {
      queryParams.push(maxPrice);
      query += `
        AND (prices->>'${currentMonth}')::jsonb->>'total_price'::numeric <= $${queryParams.length}
      `;
    }


    query += `
      ORDER BY updated_at DESC
      LIMIT $${queryParams.length + 1}
      OFFSET $${queryParams.length + 2}
    `;
    queryParams.push(Number(limit), offset);

    const { rows } = await pool.query(query, queryParams);

    if (rows.length === 0) {
      res.status(200).json({
        message: "No tours found",
        data: {
          tours: [],
          pagination: {
            total: 0,
            page: Number(page),
            limit: Number(limit),
            totalPages: 0,
          },
        },
      });
      return;
    }

    const totalCount = parseInt(rows[0].total_count);
    const totalPages = Math.ceil(totalCount / Number(limit));

  
    const tours = rows.map((tour) => {
      const currentPrices = tour.prices[currentMonth] || {
        total_price: 0,
        reservation_price: 0
      };

      return {
        ...tour,
        total_price: currentPrices.total_price,
        reservation_price: currentPrices.reservation_price,
        localizations: tour.localizations || [],
        total_count: undefined
      };
    });

    res.status(200).json({
      message: "Tours retrieved successfully",
      data: {
        tours,
        pagination: {
          total: totalCount,
          page: Number(page),
          limit: Number(limit),
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching tours:", error);
    res.status(500).json({
      message: "Internal server error while fetching tours",
    });
  }
};

export const getTourById = async (req: Request, res: Response): Promise<void> => {
  try {
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
    const currentMonth = (new Date().getMonth() + 1).toString();

    let query = `
      SELECT 
        t.id,
        t.prices,
        t.duration,
        t.image,
        t.public,
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

    // Get current month's prices
    const currentPrices = rows[0].prices[currentMonth] || {
      total_price: 0,
      reservation_price: 0
    };

    // Create the tour object with both current prices and full price history
    const tour = {
      ...rows[0],
      // Add current month's prices at top level for backward compatibility
      total_price: currentPrices.total_price,
      reservation_price: currentPrices.reservation_price,
      // Keep the full prices object
      prices: rows[0].prices,
      localizations: rows[0].localizations || [],
      translations: (rows[0].localizations || []).reduce((acc: any, loc: any) => {
        acc[loc.locale] = {
          start_location: loc.start_location,
          next_location: loc.next_location,
          description: loc.description
        };
        return acc;
      }, {}),
      // Add current month info for reference
      currentMonth: currentMonth
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
      prices,
      public: isPublic,
      image = null, 
      gallery = null,
      deleteImages = null
    } = result.data;

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

    let mainImageUrl = tour.image;
    let updatedGallery = tour.gallery || [];

    // Handle deleted images
    if (deleteImages !== null && deleteImages.length > 0) {
      updatedGallery = updatedGallery.filter(
        (imageUrl: string) => !deleteImages.includes(imageUrl)
      );
    }

    // Process new image and gallery uploads
    if (image !== null || gallery !== null) {
      let galleryUrls: string[] = [];
      
      if (image && gallery) {
        const processedImages = await saveBase64Images(image, gallery);
        mainImageUrl = processedImages.mainImageUrl;
        galleryUrls = processedImages.galleryUrls;
      } else if (image) {
        const processedImages = await saveBase64Images(image, []);
        mainImageUrl = processedImages.mainImageUrl;
      } else if (gallery) {
        const processedImages = await saveBase64Images(null, gallery);
        galleryUrls = processedImages.galleryUrls;
      }

      if (gallery !== null) {
        updatedGallery = [...updatedGallery, ...galleryUrls];
      }
    }

    let updateFields = [
      'localizations = $2',
      'duration = $3',
      'prices = $4',
      'public = $5',
      'updated_at = NOW()'
    ];
    
    let values = [
      id,
      JSON.stringify(localizations),
      duration,
      JSON.stringify(prices),
      isPublic,
    ];

    if (image !== null) {
      updateFields.push(`image = $${values.length + 1}`);
      values.push(mainImageUrl);
    }

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

    // Add current month's prices to the response for backward compatibility
    const currentMonth = (new Date().getMonth() + 1).toString();
    const currentPrices = updatedTour.prices[currentMonth] || {
      total_price: 0,
      reservation_price: 0
    };

    const responseData = {
      ...updatedTour,
      total_price: currentPrices.total_price,
      reservation_price: currentPrices.reservation_price
    };

    res.status(200).json({
      message: 'Tour updated successfully',
      data: responseData
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

 