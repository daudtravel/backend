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

    const { 
      localizations, 
      duration, 
      group_prices, 
      individual_prices,
      type = false,
      image, 
      gallery = [],
      date  // New date field
    } = result.data;

    // Simplified validation for group prices - now as a single object
    const validateGroupPrices = (prices: any): boolean => {
      if (!prices || typeof prices !== 'object') return true;

      const { total_price, reservation_price, discounted_price } = prices;
      
      // Check if any price exists and is a valid number
      return (total_price === undefined || typeof total_price === 'number') &&
             (reservation_price === undefined || typeof reservation_price === 'number') &&
             (discounted_price === undefined || typeof discounted_price === 'number');
    };

    // Simplified validation for individual prices
    const validateIndividualPrices = (prices: any): boolean => {
      if (!prices || Object.keys(prices).length === 0) return true;

      return Object.entries(prices).every(([month, monthPrice]) => {
        if (!monthPrice) return true; // Skip if month is empty

        const { per_person, room_prices } = monthPrice as any;

        // Validate per_person prices if they exist
        const validPerPerson = !per_person || Object.entries(per_person).every(
          ([key, value]) => value === undefined || typeof value === 'number'
        );

        // Validate room_prices if they exist
        const validRoomPrices = !room_prices || Object.entries(room_prices).every(
          ([key, value]) => value === undefined || typeof value === 'number'
        );

        return validPerPerson && validRoomPrices;
      });
    };

    // Validate based on tour type
    if (type) {
      // Individual tour - validate individual prices
      if (!validateIndividualPrices(individual_prices)) {
        res.status(400).json({
          message: 'Invalid individual prices structure'
        });
        return;
      }
    } else {
      // Group tour - validate group prices
      if (!validateGroupPrices(group_prices)) {
        res.status(400).json({
          message: 'Invalid group prices structure'
        });
        return;
      }
    }

    const tourId = uuidv4();
    const { mainImageUrl, galleryUrls } = await saveBase64Images(image, gallery);

    // Clean up prices before saving
    const cleanedGroupPrices = type ? {} : group_prices;
    const cleanedIndividualPrices = type ? individual_prices : {};

    const createQuery = `
      INSERT INTO tours (
        id,
        localizations,
        duration,
        group_prices,
        individual_prices,
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
      duration,
      JSON.stringify(cleanedGroupPrices),
      JSON.stringify(cleanedIndividualPrices),
      type,
      mainImageUrl,
      galleryUrls,
      false, // default public value
      date   // Add the date value to the values array
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
        t.duration,
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

    const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

    const tours = rows.map(tour => {
      // Default structures
      const defaultGroupPrice = {
        total_price: null,
        reservation_price: null,
        discounted_price: null
      };

      const defaultIndividualPrice = {
        per_person: {},
        room_prices: {}
      };

      return {
        id: tour.id,
        localizations: tour.localizations || [],
        duration: tour.duration,
        type: tour.type || false,
        public: tour.public || false,
        image: tour.image,
        gallery: tour.gallery || [],
        date: tour.date || null,
        created_at: tour.created_at,
        updated_at: tour.updated_at,
        // Handle group prices as a single object
        group_prices: tour.type ? {} : (tour.group_prices || defaultGroupPrice),
        // Handle individual prices with monthly structure only when type is true
        individual_prices: tour.type ? months.reduce((acc, month) => {
          acc[month] = tour.individual_prices?.[month] || defaultIndividualPrice;
          return acc;
        }, {} as Record<string, any>) : {}
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

    let query = `
      SELECT 
        t.id,
        t.group_prices,
        t.individual_prices,
        t.duration,
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

    if (minPrice !== undefined) {
      queryParams.push(minPrice);
      query += `
        AND EXISTS (
          SELECT 1
          FROM jsonb_each(t.group_prices) gp
          WHERE (gp.value->>'total_price')::numeric >= $${queryParams.length}
        )
      `;
    }

    if (maxPrice !== undefined) {
      queryParams.push(maxPrice);
      query += `
        AND EXISTS (
          SELECT 1
          FROM jsonb_each(t.group_prices) gp
          WHERE (gp.value->>'total_price')::numeric <= $${queryParams.length}
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

    const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

    const tours = rows.map(tour => {
      // Default structures
      const defaultGroupPrice = {
        total_price: null,
        reservation_price: null,
        discounted_price: null
      };

      const defaultIndividualPrice = {
        per_person: {},
        room_prices: {}
      };

      return {
        id: tour.id,
        localizations: tour.localizations || [],
        duration: tour.duration,
        type: tour.type || false,
        public: tour.public || false,
        image: tour.image,
        gallery: tour.gallery || [],
        date: tour.date || null,
        created_at: tour.created_at,
        updated_at: tour.updated_at,
        // Handle group prices as a single object
        group_prices: tour.type ? {} : (tour.group_prices || defaultGroupPrice),
        // Handle individual prices with monthly structure only when type is true
        individual_prices: tour.type ? months.reduce((acc, month) => {
          acc[month] = tour.individual_prices?.[month] || defaultIndividualPrice;
          return acc;
        }, {} as Record<string, any>) : {}
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
              t.date,  -- Retrieve the date from the database
              CASE 
                  WHEN t.type = false THEN t.group_prices
                  ELSE '{}'::jsonb
              END as group_prices,
              CASE 
                  WHEN t.type = true THEN t.individual_prices
                  ELSE '{}'::jsonb
              END as individual_prices,
              t.duration,
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

      // Process localizations into translations
      const translations = (tourData.localizations || []).reduce((acc: any, loc: any) => {
          acc[loc.locale] = {
              start_location: loc.start_location,
              next_location: loc.next_location,
              description: loc.description,
          };
          return acc;
      }, {});

      // Process prices based on tour type
      let processedGroupPrices = {};
      let processedIndividualPrices = {};

      if (!tourData.type) {
          // Group tour prices
          processedGroupPrices = tourData.group_prices || {};
      } else {
          // Individual tour prices
          processedIndividualPrices = tourData.individual_prices || {};
      }

      // Construct tour object
      const tour = {
          id: tourData.id,
          duration: tourData.duration,
          type: tourData.type || false,
          public: tourData.public || false,
          image: tourData.image,
          date: tourData.date, // Include the date in the tour object
          gallery: tourData.gallery || [],
          created_at: tourData.created_at,
          updated_at: tourData.updated_at,
          localizations: tourData.localizations || [],
          translations,
          group_prices: processedGroupPrices,
          individual_prices: processedIndividualPrices
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
          duration,
          group_prices,
          individual_prices,
          public: isPublic,
          type = false,
          date, // Extracted top-level date
          image = null,
          gallery = null,
          deleteImages = null
      } = result.data;

      // Validate individual prices structure
      const validateIndividualPrices = (prices: any): boolean => {
          if (!prices || Object.keys(prices).length === 0) return true;

          return Object.entries(prices).every(([month, monthPrice]) => {
              if (!monthPrice) return true; // Skip if month is empty

              const { per_person, room_prices } = monthPrice as any;

              // Validate per_person prices if they exist
              const validPerPerson = !per_person || Object.entries(per_person).every(
                  ([key, value]) => value === undefined || typeof value === 'number'
              );

              // Validate room_prices if they exist
              const validRoomPrices = !room_prices || Object.entries(room_prices).every(
                  ([key, value]) => value === undefined || typeof value === 'number'
              );

              return validPerPerson && validRoomPrices;
          });
      };

      // Validate based on tour type
      if (type) {
          // Individual tour - validate individual prices
          if (!validateIndividualPrices(individual_prices)) {
              res.status(400).json({
                  message: 'Invalid individual prices structure'
              });
              return;
          }
      }

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
        'duration = $3',
        'group_prices = $4',
        'individual_prices = $5',
        'public = $6',
        'type = $7',
        'date = $8', // Include the new date field in the update query
        'updated_at = NOW()'
      ];

      let values: any[] = [
        id,
        JSON.stringify(localizations),
        duration,
        JSON.stringify(group_prices),
        JSON.stringify(individual_prices),
        isPublic,
        type,
        date // Add date to the query values
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

      // Prepare response data with separate group and individual prices
      const responseData = {
        message: 'Tour updated successfully',
        data: {
            group_prices,         // Group prices object
            individual_prices     // Individual prices object
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

 