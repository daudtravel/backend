import { z } from "zod";

 
const TranslationSchema = z.object({
  locale: z.string().min(1, "Locale is required"),
  start_location: z.string().min(1, "Name is required"),
  end_location: z.string().min(1, "Destination is required"),
 
});

export const CreateTransfersSchema = z.object({
  localizations: z.array(TranslationSchema).min(1, "At least one localization is required"),
  total_price: z.number().positive("Total price must be positive"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"), 
  reservation_price: z.number().positive("Reservation price must be positive"),

});