
import { Request, Response } from "express";
import * as faqService from "../services/faqService";

export const createFAQ = async (req: Request, res: Response): Promise<void> => {
  try {
    const createdFAQ = await faqService.createFAQ(req.body);

    res.status(201).json({
      message: "FAQ created successfully",
      data: createdFAQ,
    });
  } catch (error: any) {
    console.error("Error creating FAQ:", error);

    if (error.status) {
      res.status(error.status).json({
        message: error.message,
        errors: error.errors,
      });
    } else {
      res.status(500).json({
        message: "Internal server error while creating FAQ",
      });
    }
  }
};

export const updateFAQ = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updatedFAQ = await faqService.updateFAQ(id, req.body);

    res.status(200).json({
      message: "FAQ updated successfully",
      data: updatedFAQ,
    });
  } catch (error: any) {
    console.error("Error updating FAQ:", error);

    if (error.status) {
      res.status(error.status).json({
        message: error.message,
        errors: error.errors,
      });
    } else {
      res.status(500).json({
        message: "Internal server error while updating FAQ",
      });
    }
  }
};

export const getAllfaq = async (req: Request, res: Response): Promise<void> => {
  try {
    const faq = await faqService.getAllFAQ();

    res.status(200).json({
      message: "FAQ retrieved successfully",
      data: faq,
    });
  } catch (error) {
    console.error("Error retrieving FAQ:", error);
    res.status(500).json({
      message: "Internal server error while retrieving FAQ",
    });
  }
};

export const getFaqById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const faq = await faqService.getFAQById(id);

    res.status(200).json({
      message: "FAQ retrieved successfully",
      data: faq,
    });
  } catch (error: any) {
    console.error("Error retrieving FAQ by ID:", error);

    if (error.status) {
      res.status(error.status).json({
        message: error.message,
      });
    } else {
      res.status(500).json({
        message: "Internal server error while retrieving FAQ",
      });
    }
  }
};

export const deleteFAQ = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await faqService.deleteFAQ(id);

    res.status(200).json({
      message: "FAQ deleted successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Error deleting FAQ:", error);

    if (error.status) {
      res.status(error.status).json({
        message: error.message,
      });
    } else {
      res.status(500).json({
        message: "Internal server error while deleting FAQ",
      });
    }
  }
};
