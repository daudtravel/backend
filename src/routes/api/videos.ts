import { Router } from "express";
import { createVideo, deleteVideo, getAllVideos } from "../../handlers/videos";
 
const videosRouter = Router();

videosRouter.post("/create_video",  createVideo);
videosRouter.get("/video",  getAllVideos);
videosRouter.get("/delete_video",  deleteVideo);
 


export default videosRouter;