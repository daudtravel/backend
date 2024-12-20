import { z } from "zod";


const TranslationSchema = z.object({
  name: z.string().optional(),
  destination: z.string().optional(),
  description: z.string().optional(),
}).transform(data => ({
  name: data.name || 'undefined',
  destination: data.destination || 'undefined', 
  description: data.description || 'undefined'
}));

export const TourSchema = z.object({
  translations: z.object({
    en: TranslationSchema,
    ka: TranslationSchema,
    ru: TranslationSchema,
  }),
  duration: z.number().min(0, "Duration must be a positive number"),
  total_price: z.number().min(0, "Total price must be a positive number"),
  reservation_price: z.number().min(0, "Reservation price must be a positive number"),
  image_url: z.string().optional(),
 
});
