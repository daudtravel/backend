import { Router } from "express";
import { createTour, deleteTour, getAllTours, getTourById, updateTour } from "../../handlers/tours";
 
const toursRouter = Router();
 

toursRouter.post("/create_tour",  createTour);
toursRouter.get("/tours",  getAllTours);
toursRouter.get("/tours/:id",  getTourById);
toursRouter.put("/tours/:id",  updateTour);
toursRouter.delete("/tours/:id",  deleteTour);

export default toursRouter;