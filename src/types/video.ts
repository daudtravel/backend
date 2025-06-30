export interface Video {
  id: string;
  youtube_link: string;
  title: string;
  description?: string;
  created_at: Date;
}

export interface CreateVideoData {
  youtube_link: string;
  title: string;
  description?: string;
}

export interface DeleteVideoResult {
  id: string;
}
