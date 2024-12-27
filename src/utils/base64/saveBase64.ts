import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';


const BASE_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'tours');

export const saveBase64Images = async (
  mainImage: string | null,
  galleryImages: (string | null)[] = []
): Promise<{ mainImageUrl: string | null; galleryUrls: (string | null)[] }> => {
  try {
    const mainImageUrl = mainImage ? await saveBase64Image(mainImage) : null;
    const galleryUrls = await Promise.all(
      galleryImages.map(async (base64String) => {
        return base64String ? await saveBase64Image(base64String) : null;
      })
    );
    
    return {
      mainImageUrl,
      galleryUrls
    };
  } catch (error) {
    console.error('Error saving images:', error);
    throw new Error(`Failed to save images`);
  }
};

export const saveBase64Image = async (base64String: string): Promise<string> => {
  try {
    if (!base64String || !base64String.includes(';base64,')) {
      throw new Error('Invalid base64 string format');
    }

    const matches = base64String.match(/^data:image\/([A-Za-z]+);base64,/);
    if (!matches) {
      throw new Error('Invalid image format');
    }
    const extension = `.${matches[1]}`;
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `${uuidv4()}${extension}`;
    await fs.mkdir(BASE_UPLOAD_DIR, { recursive: true });
 
    const filePath = path.join(BASE_UPLOAD_DIR, filename);
    await fs.writeFile(filePath, buffer);
    
    return `/uploads/tours/${filename}`;
  } catch (error) {
    console.error('Error saving image:', error);
    throw new Error(`Failed to save image`);
  }
};