import { v4 as uuidv4 } from "uuid";
import pool from "../config/sql";
import { CreateTransfersSchema } from "../schemas/transfers/createaTransferSchema";
import { EditTransferSchema } from "../schemas/transfers/editTrasnferSchema";
import {
  Transfer,
  CreateTransferData,
  UpdateTransferData,
  DeleteTransferResult,
} from "../types/transfers";

export const createTransfer = async (
  data: CreateTransferData
): Promise<Transfer> => {
  const result = CreateTransfersSchema.safeParse(data);

  if (!result.success) {
    const error = new Error("Invalid input data") as any;
    error.status = 400;
    error.errors = result.error.format();
    throw error;
  }

  const { localizations, prices } = result.data;
  const id = uuidv4();

  const query = `
    INSERT INTO transfers (id, localizations, prices, created_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    RETURNING *;
  `;

  const values = [id, JSON.stringify(localizations), JSON.stringify(prices)];
  const {
    rows: [createdTransfer],
  } = await pool.query(query, values);

  return {
    id: createdTransfer.id,
    localizations: createdTransfer.localizations,
    prices: createdTransfer.prices,
    created_at: createdTransfer.created_at,
  };
};

export const getAllTransfers = async (locale?: string): Promise<Transfer[]> => {
  let query = `
    SELECT 
      t.*,
      CASE
        WHEN $1::text IS NOT NULL THEN (
          SELECT jsonb_agg(loc)
          FROM jsonb_array_elements(t.localizations) loc
          WHERE loc->>'locale' = $1
        )
        ELSE t.localizations
      END as filtered_localizations
    FROM transfers t
  `;

  const queryParams = [locale || null];

  if (locale) {
    query += `
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(t.localizations) loc
        WHERE loc->>'locale' = $1
      )
    `;
  }

  const { rows } = await pool.query(query, queryParams);

  return rows.map((row) => ({
    id: row.id,
    localizations:
      row.filtered_localizations?.length > 0
        ? row.filtered_localizations
        : row.localizations,
    prices: row.prices,
    created_at: row.created_at,
  }));
};

export const getTransferById = async (id: string): Promise<Transfer> => {
  if (!id) {
    const error = new Error("Transfer ID is required") as any;
    error.status = 400;
    throw error;
  }

  const query = `SELECT * FROM transfers WHERE id = $1`;
  const { rows } = await pool.query(query, [id]);

  if (!rows.length) {
    const error = new Error(`No transfer found with ID: ${id}`) as any;
    error.status = 404;
    throw error;
  }

  const transfer = rows[0];

  return {
    id: transfer.id,
    localizations: transfer.localizations,
    prices: transfer.prices,
    created_at: transfer.created_at,
  };
};

export const updateTransfer = async (
  id: string,
  data: UpdateTransferData
): Promise<Transfer> => {
  const result = EditTransferSchema.safeParse(data);

  if (!result.success) {
    const error = new Error("Invalid input data") as any;
    error.status = 400;
    error.errors = result.error.format();
    throw error;
  }

  const { localizations, prices } = result.data;

  const query = `
    UPDATE transfers
    SET localizations = $1, prices = $2
    WHERE id = $3
    RETURNING *;
  `;

  const values = [JSON.stringify(localizations), JSON.stringify(prices), id];
  const { rows } = await pool.query(query, values);

  if (!rows.length) {
    const error = new Error(`Transfer with ID ${id} not found`) as any;
    error.status = 404;
    throw error;
  }

  const updated = rows[0];

  return {
    id: updated.id,
    localizations: updated.localizations,
    prices: updated.prices,
    created_at: updated.created_at,
  };
};

export const deleteTransfer = async (
  id: string
): Promise<DeleteTransferResult> => {
  const query = `DELETE FROM transfers WHERE id = $1 RETURNING id`;
  const { rows } = await pool.query(query, [id]);

  if (!rows.length) {
    const error = new Error(`Transfer with ID ${id} not found`) as any;
    error.status = 404;
    throw error;
  }

  return { id: rows[0].id };
};
