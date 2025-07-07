import { Router } from "express";
import {
  createTour,
  deleteTour,
  getAllTours,
  getPublicTours,
  getTourById,
  updateTour,
} from "../../controllers/toursController";
import verifyToken from "../../middlewares/auth-middleware";

const toursRouter = Router();

toursRouter.post("/create_tour", verifyToken, createTour);
toursRouter.get("/toursAll", verifyToken, getAllTours);
toursRouter.get("/tours", getPublicTours);
toursRouter.get("/tours/:id", getTourById);
toursRouter.put("/tours/:id", verifyToken, updateTour);
toursRouter.delete("/tours/:id", verifyToken, deleteTour);

export default toursRouter;
