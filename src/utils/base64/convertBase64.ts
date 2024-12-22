import { saveBase64Image } from "./saveBase64";

export const saveBase64Images = async (
  mainImage: string,
  galleryImages: string[] = []
): Promise<{ mainImageUrl: string; galleryUrls: string[] }> => {
  try {
    const mainImageUrl = await saveBase64Image(mainImage);
    const galleryUrls = await Promise.all(
      galleryImages.map(base64String => saveBase64Image(base64String))
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