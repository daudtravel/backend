import { Router } from "express";
import { createTour, deleteTour, getAllTours, getPublicTours, getTourById, updateTour } from "../../handlers/tours";
 
const toursRouter = Router();
 

toursRouter.post("/create_tour",  createTour);
toursRouter.get("/toursAll",  getAllTours);
toursRouter.get("/tours",  getPublicTours);
toursRouter.get("/tours/:id",  getTourById);
toursRouter.put("/tours/:id",  updateTour);
toursRouter.delete("/tours/:id",  deleteTour);

export default toursRouter;