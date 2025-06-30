import { v4 as uuidv4 } from "uuid";
import pool from "../config/sql";
import { saveBase64Images } from "../utils/base64/convertBase64";

export const createTourService = async (tourData: any) => {
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
    daily,
  } = tourData;

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
    daily,
  ];

  const {
    rows: [createdTour],
  } = await pool.query(createQuery, values);
  return createdTour;
};

export const getAllToursService = async (queryParams: any) => {
  const { page = 1, limit = 10, locale } = queryParams;
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

  const queryParamsArray: any[] = [locale || null];

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
    LIMIT $${queryParamsArray.length + 1}
    OFFSET $${queryParamsArray.length + 2}
  `;
  queryParamsArray.push(Number(limit), offset);

  const { rows } = await pool.query(query, queryParamsArray);

  if (rows.length === 0) {
    return {
      tours: [],
      pagination: {
        total: 0,
        page: Number(page),
        limit: Number(limit),
        totalPages: 0,
      },
    };
  }

  const totalCount = parseInt(rows[0].total_count);
  const totalPages = Math.ceil(totalCount / Number(limit));

  const tours = rows.map((tour) => {
    const defaultGroupPrice = {
      total_price: null,
      reservation_price: null,
      discounted_price: null,
    };

    const defaultIndividualPrice = {
      season: {
        total_price: null,
        discounted_price: null,
        reservation_price: null,
      },
      off_season: {
        total_price: null,
        discounted_price: null,
        reservation_price: null,
      },
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

  return {
    tours,
    pagination: {
      total: totalCount,
      page: Number(page),
      limit: Number(limit),
      totalPages,
    },
  };
};

export const getPublicToursService = async (queryParams: any) => {
  const { page = 1, limit = 10, locale, isGroup, start_location } = queryParams;
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
    WHERE t.public = true
  `;

  const queryParamsArray: any[] = [locale || null];

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
    queryParamsArray.push(start_location);
    query += `
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(t.localizations) loc
        WHERE loc->>'start_location' = $${queryParamsArray.length}
      )
    `;
  }

  if (isGroup !== undefined) {
    const isGroupBoolean = isGroup === "true";
    queryParamsArray.push(!isGroupBoolean);
    query += `
      AND t.type = $${queryParamsArray.length}
    `;
  }

  query += `
    ORDER BY updated_at DESC
    LIMIT $${queryParamsArray.length + 1}
    OFFSET $${queryParamsArray.length + 2}
  `;
  queryParamsArray.push(Number(limit), offset);

  const { rows } = await pool.query(query, queryParamsArray);

  if (rows.length === 0) {
    return {
      tours: [],
      pagination: {
        total: 0,
        page: Number(page),
        limit: Number(limit),
        totalPages: 0,
      },
    };
  }

  const totalCount = parseInt(rows[0].total_count);
  const totalPages = Math.ceil(totalCount / Number(limit));

  const tours = rows.map((tour) => {
    const defaultGroupPrice = {
      total_price: null,
      reservation_price: null,
      discounted_price: null,
    };

    const defaultIndividualPrice = {
      season: {
        total_price: null,
        discounted_price: null,
        reservation_price: null,
      },
      off_season: {
        total_price: null,
        discounted_price: null,
        reservation_price: null,
      },
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

  return {
    tours,
    pagination: {
      total: totalCount,
      page: Number(page),
      limit: Number(limit),
      totalPages,
    },
  };
};

export const getTourByIdService = async (id: string, locale?: string) => {
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
    return null;
  }

  const tourData = rows[0];
  const defaultGroupPrice = {
    total_price: null,
    reservation_price: null,
    discounted_price: null,
  };

  const defaultIndividualPrice = {
    season: {
      total_price: null,
      discounted_price: null,
      reservation_price: null,
    },
    off_season: {
      total_price: null,
      discounted_price: null,
      reservation_price: null,
    },
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

  return tour;
};

export const updateTourService = async (id: string, updateData: any) => {
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
    deleteImages = null,
  } = updateData;

  const checkQuery = `SELECT gallery, image, type FROM tours WHERE id = $1`;
  const {
    rows: [tour],
  } = await pool.query(checkQuery, [id]);

  if (!tour) {
    return null;
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
    "localizations = $2",
    "day = $3",
    "night = $4",
    "daily = $5",
    "group_prices = $6",
    "individual_prices = $7",
    "public = $8",
    "type = $9",
    "date = $10",
    "amount_persons = $11",
    "updated_at = NOW()",
  ];

  let values: any[] = [
    id,
    JSON.stringify(localizations),
    day,
    night,
    daily,
    finalGroupPrices ? JSON.stringify(finalGroupPrices) : null,
    finalIndividualPrices ? JSON.stringify(finalIndividualPrices) : null,
    isPublic,
    type,
    finalDate,
    finalAmountPersons,
  ];

  if (image !== null) {
    updateFields.push(`image = $${values.length + 1}`);
    values.push(mainImageUrl);
  }

  if (gallery !== null || deleteImages !== null) {
    updateFields.push(`gallery = $${values.length + 1}`);
    values.push(updatedGallery);
  }

  const updateQuery = `UPDATE tours SET ${updateFields.join(
    ", "
  )} WHERE id = $1 RETURNING *`;
  const {
    rows: [updatedTour],
  } = await pool.query(updateQuery, values);

  return {
    updatedTour,
    daily,
    finalGroupPrices,
    finalIndividualPrices,
    finalAmountPersons,
  };
};

export const deleteTourService = async (id: string) => {
  const checkQuery = `SELECT EXISTS (SELECT 1 FROM tours WHERE id = $1) AS exists`;
  const {
    rows: [{ exists: tourExists }],
  } = await pool.query(checkQuery, [id]);

  if (!tourExists) {
    return false;
  }

  const deleteQuery = `DELETE FROM tours WHERE id = $1 RETURNING id`;
  await pool.query(deleteQuery, [id]);
  return true;
};
