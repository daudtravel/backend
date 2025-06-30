import pool from "../config/sql";
import { v4 as uuidv4 } from "uuid";
import { saveBase64Images } from "../utils/base64/saveBase64";
import CreateDriversSchema from "../schemas/transfers/createDriversSchema";
import {
  CreateDriverData,
  Driver,
  GetAllDriversResult,
} from "../types/drivers";

export const createDriver = async (data: CreateDriverData): Promise<Driver> => {
  const result = CreateDriversSchema.safeParse(data);

  if (!result.success) {
    throw {
      status: 400,
      message: "Invalid input data",
      errors: result.error.format(),
    };
  }

  const { firstname, lastname, image } = result.data;
  const driverID = uuidv4();
  const { mainImageUrl } = await saveBase64Images(image);

  const createQuery = `
    INSERT INTO drivers (
      id, firstname, lastname, image
    ) VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;

  const values = [driverID, firstname, lastname, mainImageUrl];
  const {
    rows: [createdDriver],
  } = await pool.query(createQuery, values);

  return createdDriver;
};

export const getAllDrivers = async (): Promise<GetAllDriversResult> => {
  const query = `SELECT id, firstname, lastname, image FROM drivers`;
  const { rows: drivers } = await pool.query(query);

  return {
    drivers,
    count: drivers.length,
  };
};

export const deleteDriver = async (id: string): Promise<Driver> => {
  if (!id) {
    throw {
      status: 400,
      message: "Driver ID is required",
    };
  }

  const deleteQuery = `
    DELETE FROM drivers 
    WHERE id = $1 
    RETURNING *;
  `;

  const { rows } = await pool.query(deleteQuery, [id]);

  if (rows.length === 0) {
    throw {
      status: 404,
      message: "Driver not found",
    };
  }

  return rows[0];
};
