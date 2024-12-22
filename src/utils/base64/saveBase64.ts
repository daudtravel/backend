
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';


export const saveBase64Image = async (base64String: string): Promise<string> => {
    try {
    
      const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `${uuidv4()}${path.extname(base64String.substring(base64String.indexOf('/') + 1, base64String.indexOf(';')))}`;
      const uploadDir = path.join(__dirname, '../uploads');
      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, filename);
      await fs.writeFile(filePath, buffer);

      return `/uploads/tours/${filename}`;
      
    } catch (error) {
      console.error('Error saving image:', error);
      throw new Error('Failed to save image');
    }
  };