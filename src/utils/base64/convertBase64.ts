import { saveBase64Image } from "./saveBase64";

export const saveBase64Images = async (
  mainImage: string | null,
  galleryImages: string[] | null = null
): Promise<{ mainImageUrl: string | null; galleryUrls: string[] }> => {
  try {
    const mainImageUrl = mainImage ? await saveBase64Image(mainImage) : null;
    const galleryUrls = galleryImages 
      ? await Promise.all(galleryImages.map(base64String => saveBase64Image(base64String)))
      : [];
    
    return {
      mainImageUrl,
      galleryUrls
    };
  } catch (error) {
    console.error('Error saving images:', error);
    throw new Error(`Failed to save images`);
  }
};