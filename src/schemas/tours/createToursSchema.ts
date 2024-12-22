import { z } from "zod";

 
const TranslationSchema = z.object({
  locale: z.string().min(1, "Locale is required"),
  name: z.string().min(1, "Name is required"),
  destination: z.string().min(1, "Destination is required"),
  description: z.string().min(1, "Description is required"),
});

export const CreateToursSchema = z.object({
  localizations: z.array(TranslationSchema).min(1, "At least one localization is required"),
  duration: z.number().positive("Duration must be positive"),
  total_price: z.number().positive("Total price must be positive"),
  reservation_price: z.number().positive("Reservation price must be positive"),
  image: z.string().regex(/^data:image\/[a-zA-Z]+;base64,/),
  gallery: z.array(z.string().regex(/^data:image\/[a-zA-Z]+;base64,/)).optional(),
});