import { Request, Response } from "express";
import * as videosService from "../services/videosService";

export const createVideo = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const createdVideo = await videosService.createVideo(req.body);

    res.status(201).json({
      message: "Video created successfully",
      data: createdVideo,
    });
  } catch (error: any) {
    console.error("Error creating video:", error);

    if (error.status) {
      res.status(error.status).json({
        message: error.message,
        errors: error.errors,
      });
    } else {
      res.status(500).json({
        message: "Internal server error while creating video",
      });
    }
  }
};

export const getAllVideos = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const videos = await videosService.getAllVideos();

    res.status(200).json({
      message: "Videos retrieved successfully",
      data: videos,
    });
  } catch (error) {
    console.error("Error retrieving videos:", error);
    res.status(500).json({
      message: "Internal server error while retrieving videos",
    });
  }
};

export const deleteVideo = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await videosService.deleteVideo(id);

    res.status(200).json({
      message: "Video deleted successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Error deleting video:", error);

    if (error.status) {
      res.status(error.status).json({
        message: error.message,
      });
    } else {
      res.status(500).json({
        message: "Internal server error while deleting video",
      });
    }
  }
};
