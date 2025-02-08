import { z } from "zod";

const TranslationSchema = z.object({
  locale: z.string().min(1, "Locale is required"),
  start_location: z.string().optional(),
  next_location: z.array(z.string()).optional().default([]),  
  description: z.string().optional()
});


const PriceSchema = z.object({
  total_price: z.number().positive("Total price must be positive"),
  reservation_price: z.number().positive("Reservation price must be positive")
});


const MonthlyPricesSchema = z.object({
  "1": PriceSchema,
  "2": PriceSchema,
  "3": PriceSchema,
  "4": PriceSchema,
  "5": PriceSchema,
  "6": PriceSchema,
  "7": PriceSchema,
  "8": PriceSchema,
  "9": PriceSchema,
  "10": PriceSchema,
  "11": PriceSchema,
  "12": PriceSchema,
}).optional();

export const CreateToursSchema = z.object({
  localizations: z.array(TranslationSchema).min(1, "At least one localization is required"),
  duration: z.string().optional(),
  prices: MonthlyPricesSchema,
  image: z.string().regex(/^data:image\/[a-zA-Z]+;base64,/),
  gallery: z.array(z.string().regex(/^data:image\/[a-zA-Z]+;base64,/)).optional(),
});