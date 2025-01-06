import { z } from "zod";

 
const TranslationSchema = z.object({
  locale: z.string().min(1, "Locale is required"),
  name: z.string().optional(),
  destination: z.string().optional(),
  description: z.string().optional(),
});

export const UpdateToursSchema = z.object({
  localizations: z.array(TranslationSchema).min(1, "At least one localization is required"),
  duration: z.number().positive("Duration must be positive"),
  total_price: z.number().positive("Total price must be positive"),
  reservation_price: z.number().positive("Reservation price must be positive"),
  image: z.string().regex(/^data:image\/[a-zA-Z]+;base64,/).nullable(),
  gallery: z.array(z.string().regex(/^data:image\/[a-zA-Z]+;base64,/)).optional().nullable(),
  deleteImages: z.array(z.string()).optional().nullable(), // New field
  public: z.boolean().default(false)
});