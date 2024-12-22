import { Router } from "express";
import { createTour, getAllTours, getTourById } from "../../handlers/tours";
// import { createTour, deleteTour, getAllTours,  getTourById,  updateTour } from "../../handlers/tours";


 

const toursRouter = Router();
 

toursRouter.post("/create_tour",  createTour);
toursRouter.get("/tours",  getAllTours);

toursRouter.get("/tours/:id",  getTourById);

// toursRouter.post("/api/create-tour",  createTour);
// toursRouter.get("/tours",   getAllTours);
// toursRouter.put("/api/tours/:id",  updateTour);
// toursRouter.get("/api/tours/:id",  getTourById);
// toursRouter.delete("/api/tours/:id",  deleteTour);



 


export default toursRouter;