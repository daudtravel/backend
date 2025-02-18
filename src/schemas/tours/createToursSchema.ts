import { z } from "zod";

const TranslationSchema = z.object({
  locale: z.string().min(1, "Locale is required"),
  start_location: z.string().optional(),
  next_location: z.array(z.string()).optional().default([]),
  description: z.string().optional()
});


const GroupPriceSchema = z.object({
  total_price: z.number().optional(),
  reservation_price: z.number().optional(),
  discounted_price: z.number().optional()
}).optional();

export const CreateToursSchema = z.object({
  localizations: z.array(TranslationSchema).min(1, "At least one localization is required"),
  day: z.string().optional(),
  night: z.string().optional(),
  group_prices: GroupPriceSchema,
  type: z.boolean().optional().default(false),
  date: z.string().or(z.date()).optional(), 
  image: z.string().regex(/^data:image\/[a-zA-Z]+;base64,/),
  gallery: z.array(z.string().regex(/^data:image\/[a-zA-Z]+;base64,/)).optional(),
});