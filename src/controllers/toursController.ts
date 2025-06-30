import { Response, Request } from "express";
import { CreateToursSchema } from "../schemas/tours/createToursSchema";
import { UpdateToursSchema } from "../schemas/tours/updateToursSchema";
import { ParamsSchema, QuerySchema } from "../schemas/tours/getToursSchema";
import {
  createTourService,
  getAllToursService,
  getPublicToursService,
  getTourByIdService,
  updateTourService,
  deleteTourService,
} from "../services/toursService";

export const createTour = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = CreateToursSchema.safeParse(req.body);

    if (!result.success) {
      console.log("Validation errors:", result.error.format());
      res.status(400).json({
        message: "Invalid input data",
        errors: result.error.format(),
      });
      return;
    }

    const createdTour = await createTourService(result.data);

    res.status(201).json({
      message: "Tour created successfully",
      data: createdTour,
    });
  } catch (error) {
    console.error("Error creating tour:", error);
    res.status(500).json({
      message: "Internal server error while creating tour",
    });
  }
};

export const getAllTours = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await getAllToursService(req.query);

    res.status(200).json({
      message:
        result.tours.length > 0
          ? "Tours retrieved successfully"
          : "No tours found",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching tours:", error);
    res.status(500).json({
      message: "Internal server error while fetching tours",
    });
  }
};

export const getPublicTours = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await getPublicToursService(req.query);

    res.status(200).json({
      message:
        result.tours.length > 0
          ? "Tours retrieved successfully"
          : "No tours found",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching public tours:", error);
    res.status(500).json({
      message: "Internal server error while fetching public tours",
    });
  }
};

export const getTourById = async (
  req: Request,
  res: Response
): Promise<void> => {
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

    const tour = await getTourByIdService(id, locale);

    if (!tour) {
      res.status(404).json({
        message: "Tour not found",
        data: null,
      });
      return;
    }

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

export const updateTour = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const paramsResult = ParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({
        message: "Invalid tour ID",
        errors: paramsResult.error.format(),
      });
      return;
    }

    const { id } = paramsResult.data;

    const result = UpdateToursSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Invalid input data",
        errors: result.error.format(),
      });
      return;
    }

    const {
      type = false,
      group_prices,
      individual_prices,
      amount_persons,
    } = result.data;

    if (type === false) {
      if (
        group_prices === null ||
        (typeof group_prices === "object" &&
          Object.keys(group_prices).length === 0)
      ) {
        res.status(400).json({
          message: "Group prices are required for group tours",
        });
        return;
      }
    } else {
      if (individual_prices === null) {
        res.status(400).json({
          message: "Individual prices are required for individual tours",
        });
        return;
      }

      if (!individual_prices || typeof individual_prices !== "object") {
        res.status(400).json({
          message: "Invalid individual prices structure",
        });
        return;
      }

      if (!individual_prices.season || !individual_prices.off_season) {
        res.status(400).json({
          message: "Individual prices must include both season and off_season",
        });
        return;
      }

      const validatePriceCategory = (category: any): boolean => {
        if (!category || typeof category !== "object") return false;

        const { total_price, discounted_price, reservation_price } = category;

        return (
          typeof total_price === "number" &&
          typeof discounted_price === "number" &&
          typeof reservation_price === "number"
        );
      };

      if (
        !validatePriceCategory(individual_prices.season) ||
        !validatePriceCategory(individual_prices.off_season)
      ) {
        res.status(400).json({
          message: "Invalid price structure in season or off_season",
        });
        return;
      }

      if (
        !amount_persons ||
        typeof amount_persons !== "number" ||
        amount_persons <= 0
      ) {
        res.status(400).json({
          message:
            "Amount of persons is required for individual tours and must be a positive number",
        });
        return;
      }
    }

    const updateResult = await updateTourService(id, result.data);

    if (!updateResult) {
      res.status(404).json({
        message: "Tour not found",
      });
      return;
    }

    const {
      daily,
      finalGroupPrices,
      finalIndividualPrices,
      finalAmountPersons,
    } = updateResult;

    const responseData = {
      message: "Tour updated successfully",
      data: {
        daily,
        ...(type === false
          ? { group_prices: finalGroupPrices }
          : {
              individual_prices: finalIndividualPrices,
              amount_persons: finalAmountPersons,
            }),
      },
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error updating tour:", error);
    res.status(500).json({
      message: "Internal server error while updating tour",
    });
  }
};

export const deleteTour = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const paramsResult = ParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({
        message: "Invalid tour ID",
        errors: paramsResult.error.format(),
      });
      return;
    }

    const { id } = paramsResult.data;

    const deleted = await deleteTourService(id);

    if (!deleted) {
      res.status(404).json({
        message: "Tour not found",
      });
      return;
    }

    res.status(200).json({
      message: "Tour deleted successfully",
      data: { id },
    });
  } catch (error) {
    console.error("Error deleting tour:", error);
    res.status(500).json({
      message: "Internal server error while deleting tour",
    });
  }
};
