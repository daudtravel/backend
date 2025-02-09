import { z } from "zod";

const TranslationSchema = z.object({
  locale: z.string().min(1, "Locale is required"),
  start_location: z.string().optional(),
  next_location: z.array(z.string()).optional().default([]),  
  description: z.string().optional()
});


const PriceSchema = z.object({
  total_price: z.number().optional(),
  reservation_price: z.number().optional()
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

export const UpdateToursSchema = z.object({
  localizations: z.array(TranslationSchema).min(1, "At least one localization is required"),
  duration: z.string().optional(),
  prices: MonthlyPricesSchema,
  image: z.string().nullable(),
  gallery: z.array(z.string()).optional().nullable(),
  deleteImages: z.array(z.string()).optional().nullable(),
  public: z.boolean().default(false)
});
