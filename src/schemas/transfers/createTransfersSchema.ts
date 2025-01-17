import { z } from "zod";

 
const TranslationSchema = z.object({
  locale: z.string().min(1, "Locale is required"),
  start_location: z.string().min(1, "Name is required"),
  end_location: z.string().min(1, "Destination is required"),
 
});

export const CreateTransfersSchema = z.object({
  localizations: z.array(TranslationSchema).min(1, "At least one localization is required"),
  total_price: z.number().positive("Total price must be positive"),
  date: z.date(),
  reservation_price: z.number().positive("Reservation price must be positive"),

});