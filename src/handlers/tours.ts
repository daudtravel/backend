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
      type, 
      image,
      gallery = [],
      date,
      amount_persons,
      individual_prices,
      daily 
    } = result.data;

     

    const tourId = uuidv4();
    const { mainImageUrl, galleryUrls } = await saveBase64Images(image, gallery);
    const finalGroupPrices = type === false ? group_prices : null;
    const finalIndividualPrices = type === true ? individual_prices : null;

    const createQuery = `
      INSERT INTO tours (
        id,
        localizations,
        day,
        night,
        group_prices,
        individual_prices,
        type,
        image,
        gallery,
        public,
        date,
        amount_persons,
        daily
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;

    const values = [
      tourId,
      JSON.stringify(localizations),
      day,
      night,
      finalGroupPrices ? JSON.stringify(finalGroupPrices) : null,
      finalIndividualPrices ? JSON.stringify(finalIndividualPrices) : null,
      type,
      mainImageUrl,
      galleryUrls,
      false,
      type === false ? date : null,
      type === true ? amount_persons : null,
      daily  // Add daily value to query parameters
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
        t.individual_prices,
        t.day,
        t.night,
        t.type,
        t.daily,
        t.image,
        t.gallery,
        t.public,
        t.date,
        t.amount_persons,
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

      const defaultIndividualPrice = {
        season: {
          total_price: null,
          discounted_price: null,
          reservation_price: null
        },
        off_season: {
          total_price: null,
          discounted_price: null,
          reservation_price: null
        }
      };

      return {
        id: tour.id,
        localizations: tour.localizations || [],
        day: tour.day,
        night: tour.night,
        type: tour.type || false,
        daily: tour.daily || false,
        public: tour.public || false,
        image: tour.image,
        gallery: tour.gallery || [],
        date: tour.date || null,
        amount_persons: tour.amount_persons || null,
        created_at: tour.created_at,
        updated_at: tour.updated_at,
        group_prices: tour.group_prices || defaultGroupPrice,
        individual_prices: tour.individual_prices || defaultIndividualPrice,
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
        t.individual_prices,
        t.day,
        t.night,
        t.type,
        t.daily,
        t.image,
        t.gallery,
        t.public,
        t.date,
        t.amount_persons,
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

    if (isGroup !== undefined) {
      const isGroupBoolean = isGroup === 'true';
      queryParams.push(!isGroupBoolean); 
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

      const defaultIndividualPrice = {
        season: {
          total_price: null,
          discounted_price: null,
          reservation_price: null
        },
        off_season: {
          total_price: null,
          discounted_price: null,
          reservation_price: null
        }
      };

      return {
        id: tour.id,
        localizations: tour.localizations || [],
        day: tour.day,
        night: tour.night,
        type: tour.type || false, 
        daily: tour.daily || false,
        public: tour.public || false,
        image: tour.image,
        gallery: tour.gallery || [],
        date: tour.date || null,
        amount_persons: tour.amount_persons || null,
        created_at: tour.created_at,
        updated_at: tour.updated_at,
        group_prices: tour.group_prices || defaultGroupPrice,
        individual_prices: tour.individual_prices || defaultIndividualPrice,
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
    
    const query = `
      SELECT 
        t.id,
        t.date,
        t.group_prices,
        t.individual_prices,
        t.day,
        t.night,
        t.type,
        t.daily,
        t.image,
        t.gallery,
        t.public,
        t.amount_persons,
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
    const defaultGroupPrice = {
      total_price: null,
      reservation_price: null,
      discounted_price: null
    };
    
    const defaultIndividualPrice = {
      season: {
        total_price: null,
        discounted_price: null,
        reservation_price: null
      },
      off_season: {
        total_price: null,
        discounted_price: null,
        reservation_price: null
      }
    };
    
    const tour = {
      id: tourData.id,
      day: tourData.day,
      night: tourData.night,
      type: tourData.type || false,
      daily: tourData.daily || false,
      public: tourData.public || false,
      image: tourData.image,
      date: tourData.date,
      amount_persons: tourData.amount_persons || null,
      gallery: tourData.gallery || [],
      created_at: tourData.created_at,
      updated_at: tourData.updated_at,
      localizations: tourData.localizations || [],
      group_prices: tourData.group_prices || defaultGroupPrice,
      individual_prices: tourData.individual_prices || defaultIndividualPrice,
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
      daily = false,  
      group_prices,
      individual_prices,
      amount_persons,
      public: isPublic,
      type = false,
      date,
      image = null,
      gallery = null,
      deleteImages = null
    } = result.data;
 
    if (type === false) {
      if (group_prices === null || (typeof group_prices === 'object' && Object.keys(group_prices).length === 0)) {
        res.status(400).json({
          message: 'Group prices are required for group tours'
        });
        return;
      }
    } else {
      if (individual_prices === null) {
        res.status(400).json({
          message: 'Individual prices are required for individual tours'
        });
        return;
      }
      
      if (!individual_prices || typeof individual_prices !== 'object') {
        res.status(400).json({
          message: 'Invalid individual prices structure'
        });
        return;
      }

      if (!individual_prices.season || !individual_prices.off_season) {
        res.status(400).json({
          message: 'Individual prices must include both season and off_season'
        });
        return;
      }
      
      const validatePriceCategory = (category: any): boolean => {
        if (!category || typeof category !== 'object') return false;
        
        const { total_price, discounted_price, reservation_price } = category;
        
        return typeof total_price === 'number' &&
               typeof discounted_price === 'number' &&
               typeof reservation_price === 'number';
      };
      
      if (!validatePriceCategory(individual_prices.season) || !validatePriceCategory(individual_prices.off_season)) {
        res.status(400).json({
          message: 'Invalid price structure in season or off_season'
        });
        return;
      }

      if (!amount_persons || typeof amount_persons !== 'number' || amount_persons <= 0) {
        res.status(400).json({
          message: 'Amount of persons is required for individual tours and must be a positive number'
        });
        return;
      }
    }

    const checkQuery =
      `SELECT gallery, image, type
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
    
   
    if (deleteImages !== null && deleteImages.length > 0) {
      updatedGallery = updatedGallery.filter(
        (imageUrl: string) => !deleteImages.includes(imageUrl)
      );
    }
   
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
    
    const finalGroupPrices = type === false ? group_prices : null;
    const finalIndividualPrices = type === true ? individual_prices : null;
    const finalDate = type === false ? date : null;
    const finalAmountPersons = type === true ? amount_persons : null;
    
    let updateFields: string[] = [
      'localizations = $2',
      'day = $3',
      'night = $4',
      'daily = $5', // Add daily field
      'group_prices = $6',
      'individual_prices = $7',
      'public = $8',
      'type = $9',
      'date = $10',
      'amount_persons = $11',
      'updated_at = NOW()'
    ];
    
    let values: any[] = [
      id,
      JSON.stringify(localizations),
      day,
      night,
      daily, // Add daily value
      finalGroupPrices ? JSON.stringify(finalGroupPrices) : null,
      finalIndividualPrices ? JSON.stringify(finalIndividualPrices) : null,
      isPublic,
      type,
      finalDate,
      finalAmountPersons
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
    
    // Prepare response data with the appropriate price structure
    const responseData = {
      message: 'Tour updated successfully',
      data: {
        daily, // Include daily in the response
        ...(type === false 
          ? { group_prices: finalGroupPrices }
          : { individual_prices: finalIndividualPrices, amount_persons: finalAmountPersons })
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

 