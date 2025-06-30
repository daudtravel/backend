import { Router } from "express";
import { createVideo, deleteVideo, getAllVideos } from "../../controllers/videosController";
 
const videosRouter = Router();

videosRouter.post("/create_video", createVideo);
videosRouter.get("/video", getAllVideos);
videosRouter.delete("/delete_video/:id", deleteVideo);



export default videosRouter;