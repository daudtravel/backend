import { v4 as uuidv4 } from 'uuid';
import pool from '../config/sql';
import { Response, Request } from 'express';
import { CreateToursSchema } from '../schemas/tours/createToursSchema';
import { saveBase64Images } from '../utils/base64/convertBase64';
import { UpdateToursSchema } from '../schemas/tours/updateToursSchema';
import { ParamsSchema, QuerySchema } from '../schemas/tours/getToursSchema';
 

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

    const {
      localizations,
      day,
      night,
      group_prices,
      type = false,
      image,
      gallery = [],
      date
    } = result.data;

    const validateGroupPrices = (prices: any, tourType: boolean): boolean => {
 
      if (tourType === true) return true;
      
 
      if (!prices || typeof prices !== 'object') return false;

      const { total_price, reservation_price, discounted_price } = prices;
      
      return (total_price === undefined || typeof total_price === 'number') &&
             (reservation_price === undefined || typeof reservation_price === 'number') &&
             (discounted_price === undefined || typeof discounted_price === 'number');
    };

    if (!validateGroupPrices(group_prices, type)) {
      res.status(400).json({
        message: 'Invalid group prices structure'
      });
      return;
    }

    const tourId = uuidv4();
    const { mainImageUrl, galleryUrls } = await saveBase64Images(image, gallery);
    const finalGroupPrices = type ? {} : (group_prices || {});

    const createQuery = `
      INSERT INTO tours (
        id,
        localizations,
        day,
        night,
        group_prices,
        type,
        image,
        gallery,
        public,
        date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;

    const values = [
      tourId,
      JSON.stringify(localizations),
      day,
      night,
      JSON.stringify(finalGroupPrices), 
      type,
      mainImageUrl,
      galleryUrls,
      false, 
      date
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
        t.group_prices,
        t.day,
        t.night,
        t.type,
        t.image,
        t.gallery,
        t.public,
        t.date,
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
      const defaultGroupPrice = {
        total_price: null,
        reservation_price: null,
        discounted_price: null
      };

      return {
        id: tour.id,
        localizations: tour.localizations || [],
        day: tour.day,
        night: tour.night,
        type: tour.type || false,
        public: tour.public || false,
        image: tour.image,
        gallery: tour.gallery || [],
        date: tour.date || null,
        created_at: tour.created_at,
        updated_at: tour.updated_at,
        group_prices: tour.group_prices || defaultGroupPrice,
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
    const { page = 1, limit = 10, locale, isGroup, start_location } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        t.id,
        t.group_prices,
        t.day,
        t.night,
        t.type,
        t.image,
        t.gallery,
        t.public,
        t.date,
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
      WHERE t.public = true -- Ensure we only fetch public tours
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

    // Filter by start_location if provided
    if (start_location) {
      queryParams.push(start_location);
      query += `
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(t.localizations) loc
          WHERE loc->>'start_location' = $${queryParams.length}
        )
      `;
    }

    // Add the filter for isGroup - NOTE THE REVERSED LOGIC: true = individual, false = group
    if (isGroup !== undefined) {
      const isGroupBoolean = isGroup === 'true';
      queryParams.push(!isGroupBoolean); // We need to flip the boolean because type=true means individual
      query += `
        AND t.type = $${queryParams.length}
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
      const defaultGroupPrice = {
        total_price: null,
        reservation_price: null,
        discounted_price: null
      };

      return {
        id: tour.id,
        localizations: tour.localizations || [],
        day: tour.day,
        night: tour.night,
        type: tour.type || false, // true = individual, false = group
        public: tour.public || false,
        image: tour.image,
        gallery: tour.gallery || [],
        date: tour.date || null,
        created_at: tour.created_at,
        updated_at: tour.updated_at,
        group_prices: tour.group_prices || defaultGroupPrice,
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
    console.error('Error fetching public tours:', error);
    res.status(500).json({
      message: 'Internal server error while fetching public tours'
    });
  }
};

export const getTourById = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramsResult = ParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({
        message: "Invalid tour ID",
        errors: paramsResult.error.format(),
      });
      return;
    }

    const queryResult = QuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({
        message: "Invalid query parameters",
        errors: queryResult.error.format(),
      });
      return;
    }

    const { id } = paramsResult.data;
    const { locale } = queryResult.data;

    let query = `
      SELECT 
        t.id,
        t.date,
        t.group_prices,
        t.day,
        t.night,
        t.type,
        t.image,
        t.gallery,
        t.public,
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

    const queryParams: any[] = [id, locale || null];

    const { rows } = await pool.query(query, queryParams);

    if (rows.length === 0) {
      res.status(404).json({
        message: "Tour not found",
        data: null,
      });
      return;
    }

    const tourData = rows[0];

    const translations = (tourData.localizations || []).reduce((acc: any, loc: any) => {
      acc[loc.locale] = {
        start_location: loc.start_location,
        next_location: loc.next_location,
        description: loc.description,
      };
      return acc;
    }, {});

    const defaultGroupPrice = {
      total_price: null,
      reservation_price: null,
      discounted_price: null
    }; 

    const tour = {
      id: tourData.id,
      day: tourData.day,
      night: tourData.night,
      type: tourData.type || false,
      public: tourData.public || false,
      image: tourData.image,
      date: tourData.date,
      gallery: tourData.gallery || [],
      created_at: tourData.created_at,
      updated_at: tourData.updated_at,
      localizations: tourData.localizations || [],
      translations,
      group_prices: tourData.group_prices || defaultGroupPrice,
    };

    res.status(200).json({
      message: "Tour retrieved successfully",
      data: { tour },
    });
  } catch (error) {
    console.error("Error fetching tour:", error);
    res.status(500).json({
      message: "Internal server error while fetching tour",
      error: process.env.NODE_ENV === "development" ? error : undefined,
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
      day,
      night,
      group_prices,
      public: isPublic,
      type = false,
      date,
      image = null,
      gallery = null,
      deleteImages = null
    } = result.data;

    const checkQuery =
      `SELECT gallery, image 
       FROM tours 
       WHERE id = $1`;

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
    let galleryUrls: string[] = [];
    
    if (image) {
      const processedImages = await saveBase64Images(image, gallery || []);
      mainImageUrl = processedImages.mainImageUrl;
      galleryUrls = processedImages.galleryUrls;
    }
    
    if (gallery) {
      const processedImages = await saveBase64Images(null, gallery);
      galleryUrls.push(...processedImages.galleryUrls);
    }

    if (gallery !== null) {
      updatedGallery.push(...galleryUrls);
    }

    let updateFields: string[] = [
      'localizations = $2',
      'day = $3',
      'night = $4',
      'group_prices = $5',
      'public = $6',
      'type = $7',
      'date = $8',
      'updated_at = NOW()'
    ];

    let values: any[] = [
      id,
      JSON.stringify(localizations),
      day,
      night,
      JSON.stringify(group_prices),
      isPublic,
      type,
      date
    ];

    if (image !== null) {
      updateFields.push(`image = $${values.length + 1}`);
      values.push(mainImageUrl);
    }

    if (gallery !== null || deleteImages !== null) {
      updateFields.push(`gallery = $${values.length + 1}`);
      values.push(updatedGallery);
    }

    const updateQuery =
      `UPDATE tours 
       SET ${updateFields.join(', ')}
       WHERE id = $1
       RETURNING *`;

    const { rows: [updatedTour] } = await pool.query(updateQuery, values);

    // Prepare response data with only group prices
    const responseData = {
      message: 'Tour updated successfully',
      data: {
        group_prices
      }
    };

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Error updating tour:', error);
    res.status(500).json({
      message: 'Internal server error while updating tour',
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

 