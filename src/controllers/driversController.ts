import { Request, Response } from "express";
import * as driversService from "../services/driversService";

export const addDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const createdDriver = await driversService.createDriver(req.body);

    res.status(201).json({
      message: "Driver created successfully",
      data: createdDriver,
    });
  } catch (error: any) {
    console.error("Error creating driver:", error);

    if (error.status) {
      res.status(error.status).json({
        message: error.message,
        errors: error.errors,
      });
    } else {
      res.status(500).json({
        message: "Internal server error while creating driver",
      });
    }
  }
};

export const getAllDrivers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await driversService.getAllDrivers();

    res.json({
      message: "Drivers retrieved successfully",
      count: result.count,
      data: result.drivers,
    });
  } catch (error) {
    console.error("Error retrieving drivers:", error);
    res.status(500).json({
      message: "Internal server error while retrieving drivers",
    });
  }
};

export const deleteDriver = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const deletedDriver = await driversService.deleteDriver(id);

    res.status(200).json({
      message: "Driver deleted successfully",
      data: deletedDriver,
    });
  } catch (error: any) {
    console.error("Error deleting driver:", error);

    if (error.status) {
      res.status(error.status).json({
        message: error.message,
      });
    } else {
      res.status(500).json({
        message: "Internal server error while deleting driver",
      });
    }
  }
};
