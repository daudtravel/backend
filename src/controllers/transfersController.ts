import { Request, Response } from "express";
import * as transferService from "../services/transfersService";

export const createTransfer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const createdTransfer = await transferService.createTransfer(req.body);
    res.status(201).json({
      message: "Transfer created successfully",
      data: createdTransfer,
    });
  } catch (error: any) {
    console.error("Error creating transfer:", error);
    res.status(error.status || 500).json({
      message: error.message || "Internal server error while creating transfer",
      ...(error.errors && { errors: error.errors }),
    });
  }
};

export const getAllTransfers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const locale = req.query.locale as string;
    const transfers = await transferService.getAllTransfers(locale);
    res.status(200).json({
      message: "Transfers retrieved successfully",
      data: transfers,
    });
  } catch (error: any) {
    console.error("Error fetching transfers:", error);
    res.status(error.status || 500).json({
      message:
        error.message || "Internal server error while fetching transfers",
    });
  }
};

export const getTransferById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const transfer = await transferService.getTransferById(id);
    res.status(200).json({
      message: `Transfer with ID ${id} retrieved successfully`,
      data: transfer,
    });
  } catch (error: any) {
    console.error("Error fetching transfer by ID:", error);
    res.status(error.status || 500).json({
      message:
        error.message || "Internal server error while fetching transfer by ID",
    });
  }
};

export const updateTransfer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const updated = await transferService.updateTransfer(id, req.body);
    res.status(200).json({
      message: "Transfer updated successfully",
      data: updated,
    });
  } catch (error: any) {
    console.error("Error updating transfer:", error);
    res.status(error.status || 500).json({
      message: error.message || "Internal server error while updating transfer",
      ...(error.errors && { errors: error.errors }),
    });
  }
};

export const deleteTransfer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await transferService.deleteTransfer(id);
    res.status(200).json({
      message: "Transfer deleted successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Error deleting transfer:", error);
    res.status(error.status || 500).json({
      message: error.message || "Internal server error while deleting transfer",
    });
  }
};
