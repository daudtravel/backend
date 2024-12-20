import { Router } from "express";
import { createTour, deleteTour, getAllTours,  getTourById,  updateTour } from "../../handlers/tours";


 

const toursRouter = Router();
 


toursRouter.post("/api/create-tour",  createTour);
toursRouter.get("/tours",   getAllTours);
toursRouter.put("/api/tours/:id",  updateTour);
toursRouter.get("/api/tours/:id",  getTourById);
toursRouter.delete("/api/tours/:id",  deleteTour);



 


export default toursRouter;