import { v4 as uuidv4 } from "uuid";
import pool from "../config/sql";
import { CreateFaqSchema } from "../schemas/faq/createFaqSchema";
import { UpdateFaqSchema } from "../schemas/faq/editFaqSchema";
import {
  FAQ,
  CreateFAQData,
  UpdateFAQData,
  DeleteFAQResult,
} from "../types/faq";

export const createFAQ = async (data: CreateFAQData): Promise<FAQ> => {
  const result = CreateFaqSchema.safeParse(data);

  if (!result.success) {
    throw {
      status: 400,
      message: "Invalid input data",
      errors: result.error.format(),
    };
  }

  const { localizations } = result.data;
  const faqId = uuidv4();

  const createQuery = `
    INSERT INTO faq (
      id,
      localizations
    )
    VALUES ($1, $2)
    RETURNING *;
  `;

  const values = [faqId, JSON.stringify(localizations)];

  const {
    rows: [createdFAQ],
  } = await pool.query(createQuery, values);
  return createdFAQ;
};

export const updateFAQ = async (
  id: string,
  data: UpdateFAQData
): Promise<FAQ> => {
  const result = UpdateFaqSchema.safeParse(data);

  if (!result.success) {
    throw {
      status: 400,
      message: "Invalid input data",
      errors: result.error.format(),
    };
  }

  const { localizations } = result.data;

  const updateQuery = `
    UPDATE faq
    SET localizations = $1
    WHERE id = $2
    RETURNING *;
  `;

  const values = [JSON.stringify(localizations), id];

  const { rows } = await pool.query(updateQuery, values);

  if (rows.length === 0) {
    throw {
      status: 404,
      message: `FAQ with ID ${id} not found`,
    };
  }

  return rows[0];
};

export const getAllFAQ = async (): Promise<FAQ[]> => {
  const faqQuery = `
    SELECT *
    FROM faq
  `;

  const { rows: faq } = await pool.query(faqQuery);
  return faq;
};

export const getFAQById = async (id: string): Promise<FAQ> => {
  if (!id) {
    throw {
      status: 400,
      message: "FAQ ID is required",
    };
  }

  const faqQuery = `
    SELECT *
    FROM faq
    WHERE id = $1
  `;

  const { rows: faq } = await pool.query(faqQuery, [id]);

  if (faq.length === 0) {
    throw {
      status: 404,
      message: "FAQ not found",
    };
  }

  return faq[0];
};

export const deleteFAQ = async (id: string): Promise<DeleteFAQResult> => {
  const deleteQuery = `
    DELETE FROM faq
    WHERE id = $1
    RETURNING id;
  `;

  const { rows } = await pool.query(deleteQuery, [id]);

  if (rows.length === 0) {
    throw {
      status: 404,
      message: `FAQ with ID ${id} not found`,
    };
  }

  return { id: rows[0].id };
};
