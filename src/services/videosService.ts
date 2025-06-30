import { v4 as uuidv4 } from "uuid";
import pool from "../config/sql";
import { VideoSchema } from "../schemas/videos/createVideoSchema";
import { Video, CreateVideoData, DeleteVideoResult } from "../types/video";

export const createVideo = async (data: CreateVideoData): Promise<Video> => {
  const result = VideoSchema.safeParse(data);

  if (!result.success) {
    throw {
      status: 400,
      message: "Invalid input data",
      errors: result.error.format(),
    };
  }

  const { youtube_link, title, description } = result.data;
  const videoId = uuidv4();

  const createQuery = `
    INSERT INTO videos (
      id,
      youtube_link,
      title,
      description,
      created_at
    )
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    RETURNING *;
  `;

  const values = [videoId, youtube_link, title, description || null];

  const {
    rows: [createdVideo],
  } = await pool.query(createQuery, values);
  return createdVideo;
};

export const getAllVideos = async (): Promise<Video[]> => {
  const videosQuery = `
    SELECT *
    FROM videos
    ORDER BY created_at DESC;
  `;

  const { rows: videos } = await pool.query(videosQuery);
  return videos;
};

export const deleteVideo = async (id: string): Promise<DeleteVideoResult> => {
  const deleteQuery = `
    DELETE FROM videos
    WHERE id = $1
    RETURNING id;
  `;

  const { rows } = await pool.query(deleteQuery, [id]);

  if (rows.length === 0) {
    throw {
      status: 404,
      message: `Video with ID ${id} not found`,
    };
  }

  return { id: rows[0].id };
};
