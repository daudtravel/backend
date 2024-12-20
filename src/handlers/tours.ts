import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import pool from '../config/sql';
import { Response, Request } from 'express';
import { CreateToursSchema } from '../schemas/tours/createToursSchema';
import { QueryParamsSchema } from '../schemas/tours/getToursSchema';
 




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

    const tourId = uuidv4();
    const { localizations, duration, total_price, reservation_price, image_url } = result.data;
    
    const query = `
      INSERT INTO tours (
        id, 
        localizations, 
        duration, 
        total_price, 
        reservation_price, 
        image_url
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const values = [
      tourId,
      JSON.stringify(localizations),
      duration,
      total_price,
      reservation_price,
      image_url,
    ];

    const { rows: [createdTour] } = await pool.query(query, values);
    
    res.status(201).json({
      message: 'Tour created successfully',
      data: createdTour
    });

  } catch (error) {
    console.error('Error creating tour:', error);
    res.status(500).json({ 
      message: 'Internal server error while creating tour',
       
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
        t.image_url,
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





// const createToursTableIfNotExists = async () => {
//   const insertTourQuery = `
//   INSERT INTO tours (id, price, reservation_price, localizations, duration, image_url)
//   VALUES ($1, $2, $3, $4, $5, $6)
// `;

// const tourData = {
//   id: 'your-uuid',
//   price: 123.45,
//   reservation_price: 23.45,
//   localizations: [
//     { locale: 'en', name: 'English Name', destination: 'English Destination', description: 'English Description' },
//     { locale: 'ka', name: 'ქართული სახელი', destination: 'ქართული დანიშნულება', description: 'ქართული აღწერა' },
//     { locale: 'ru', name: 'Русское имя', destination: 'Русское назначение', description: 'Русское описание' }
//   ],
//   duration: 10.5,
//   image_url: 'https://example.com/image.jpg'
// };

// try {
//   await pool.query(insertTourQuery, [
//     tourData.id,
//     tourData.price,
//     tourData.reservation_price,
//     JSON.stringify(tourData.localizations),
//     tourData.duration,
//     tourData.image_url
//   ]);
//   console.log("Tour inserted successfully");
// } catch (error) {
//   console.error("Error inserting tour:", error);
//   throw error;
// }
// };

// export const createTour = async (req: any, res: any) => {
//   try {
//     await createToursTableIfNotExist();
    
//     // Prepare translations with defaults
//     const body = req.body;
//     const completeTranslations = {
//       ...body,
//       translations: {
//         en: {
//           name: 'undefined',
//           destination: 'undefined',
//           description: 'undefined'
//         },
//         ka: {
//           name: 'undefined',
//           destination: 'undefined',
//           description: 'undefined'
//         },
//         ru: {
//           name: 'undefined',
//           destination: 'undefined',
//           description: 'undefined'
//         },
//         ...body.translations
//       }
//     };

//     // Validate the data
//     const validatedData = TourSchema.parse(completeTranslations);

//     // Check if tour exists
//     const tourExists = await checkIfTourExists(validatedData.translations);
//     if (tourExists) {
//       return res.status(409).json({
//         message: "TOUR_ALREADY_EXISTS",
//         error: "A tour with this name and destination already exists",
//       });
//     }

//     // Create and insert the tour
//     const tourId = uuidv4();
//     const newTour = await insertNewTour(tourId, validatedData);

//     res.status(201).json({
//       message: "TOUR_CREATED_SUCCESSFULLY",
//       tour: newTour,
//     });
//   } catch (error) {
//     handleError(error, res);
//   }
// };

// const checkIfTourExists = async (translations: any) => {
//   const query = `
//     SELECT * FROM tours 
//     WHERE 
//       (translations->'ka'->>'name' = $1 OR translations->'en'->>'name' = $1 OR translations->'ru'->>'name' = $1)
//       AND 
//       (translations->'ka'->>'destination' = $2 OR translations->'en'->>'destination' = $2 OR translations->'ru'->>'destination' = $2)
//   `;
  
//   const result = await pool.query(query, [
//     translations.ka.name || translations.en.name || translations.ru.name, 
//     translations.ka.destination || translations.en.destination || translations.ru.destination
//   ]);
  
//   return result.rows.length > 0;
// };

// const insertNewTour = async (tourId: string, validatedData: any) => {
//   const insertQuery = `
//     INSERT INTO tours (
//       id, 
//       translations, 
//       duration, 
//       total_price, 
//       reservation_price, 
//       image_url
//     ) VALUES ($1, $2, $3, $4, $5, $6)
//     RETURNING *;
//   `;
  
//   const result = await pool.query(insertQuery, [
//     tourId,
//     JSON.stringify(validatedData.translations),
//     validatedData.duration,
//     validatedData.total_price,
//     validatedData.reservation_price,
//     validatedData.image_url,
//   ]);
  
//   return result.rows[0];
// };

// const handleError = (error: any, res: any) => {
//   console.error(error);
  
//   if (error instanceof z.ZodError) {
//     return res.status(400).json({
//       message: "VALIDATION_ERROR",
//       errors: error.errors
//     });
//   }
  
//   return res.status(500).json({
//     message: "INTERNAL_SERVER_ERROR",
//     error: error.message
//   });
// };


// export const getAllTours = async (req: any, res: any) => {
//   try {
//     const selectQuery = `
//       SELECT id, translations, duration, total_price, reservation_price
//       FROM tours
//       ORDER BY created_at DESC;
//     `;

//     const result = await pool.query(selectQuery);

//     res.status(200).json({
//       message: "TOURS_RETRIEVED_SUCCESSFULLY",
//       tours: result.rows,
//     });
//   } catch (error) {
//     console.error("Error retrieving tours:", error);
//     res.status(500).json({
//       message: "INTERNAL_SERVER_ERROR",
//       error: error instanceof Error ? error.message : "An unexpected error occurred",
//     });
//   }
// };




// export const getTourById = async (req: any, res: any) => {
//   try {
//     const { id } = req.params;

//     const result = await pool.query('SELECT * FROM tours WHERE id = $1', [id]);
    
//     if (result.rows.length === 0) {
//       return res.status(404).json({
//         message: 'TOUR_NOT_FOUND',
//         error: 'No tour found with the given ID'
//       });
//     }

//     res.status(200).json({
//       message: 'TOUR_FETCHED_SUCCESSFULLY',
//       tour: result.rows[0]
//     });
//   } catch (error) {
//     console.error('Error fetching tour:', error);
//     res.status(500).json({
//       message: 'INTERNAL_SERVER_ERROR',
//       error: 'Unable to fetch tour'
//     });
//   }
// };


// export const updateTour = async (req: any, res: any) => {
//   try {
//     const { id } = req.params;

//     // Prepare translations with defaults
//     const body = req.body;
//     const completeTranslations = {
//       ...body,
//       translations: {
//         en: {
//           name: 'undefined',
//           destination: 'undefined',
//           description: 'undefined'
//         },
//         ka: {
//           name: 'undefined',
//           destination: 'undefined',
//           description: 'undefined'
//         },
//         ru: {
//           name: 'undefined',
//           destination: 'undefined',
//           description: 'undefined'
//         },
//         ...body.translations
//       }
//     };

//     // Validate the data
//     const validatedData = TourSchema.parse(completeTranslations);

//     // Check if the tour with the given ID exists
//     const checkQuery = 'SELECT * FROM tours WHERE id = $1';
//     const checkResult = await pool.query(checkQuery, [id]);

//     if (checkResult.rows.length === 0) {
//       return res.status(404).json({
//         message: "TOUR_NOT_FOUND",
//         error: "Tour with the specified ID does not exist"
//       });
//     }

//     // Prepare update query
//     const updateQuery = `
//       UPDATE tours 
//       SET 
//         translations = $1, 
//         duration = $2, 
//         total_price = $3, 
//         reservation_price = $4, 
//         image_url = $5,
//         created_at = CURRENT_TIMESTAMP
//       WHERE id = $6
//       RETURNING *
//     `;

//     const values = [
//       JSON.stringify(validatedData.translations),
//       validatedData.duration,
//       validatedData.total_price,
//       validatedData.reservation_price,
//       validatedData.image_url || null,
//       id
//     ];

//     const result = await pool.query(updateQuery, values);

//     res.status(200).json({
//       message: "TOUR_UPDATED_SUCCESSFULLY",
//       tour: result.rows[0]
//     });
//   } catch (error) {
//     // Error handling
//     if (error instanceof z.ZodError) {
//       return res.status(400).json({
//         message: "VALIDATION_ERROR",
//         errors: error.errors
//       });
//     }

//     console.error('Update Tour Error:', error);
//     res.status(500).json({
//       message: "INTERNAL_SERVER_ERROR",
//       error: "An unexpected error occurred while updating the tour"
//     });
//   }
// };


// export const deleteTour = async (req: any, res: any) => {
//   try {
//     const { id } = req.params;

//     const deleteQuery = `
//       DELETE FROM tours 
//       WHERE id = $1
//       RETURNING *;
//     `;

//     const result = await pool.query(deleteQuery, [id]);

//     if (result.rows.length === 0) {
//       return res.status(404).json({
//         message: "TOUR_NOT_FOUND",
//         error: "Tour with the specified ID does not exist or is already deleted"
//       });
//     }

//     res.status(200).json({
//       message: "TOUR_DELETED_SUCCESSFULLY",
//       tour: result.rows[0]
//     });
//   } catch (error) {
//     handleError(error, res);
//   }
// };
 
 


 