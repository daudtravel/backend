import { z } from "zod";

 
// Simplified schema for video validation
export const VideoSchema = z.object({
    youtube_link: z.string().url("Must be a valid URL"),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional()
  });