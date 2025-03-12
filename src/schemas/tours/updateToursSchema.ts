import { z } from "zod";

const TranslationSchema = z.object({
  locale: z.string().min(1, "Locale is required"),
  name: z.string().optional(),
  start_location: z.string().optional(),
  next_location: z.array(z.string()).optional().default([]),
  description: z.string().optional()
});

const GroupPriceSchema = z
  .object({
    total_price: z.number().optional(),
    reservation_price: z.number().optional(),
    discounted_price: z.number().optional(),
  })
  .nullable();

const imagePattern = z.union([
  z.string().regex(/^data:image\/[a-zA-Z]+;base64,/),
  z.string().regex(/^\/uploads\//)
]);

const IndividualPriceCategorySchema = z.object({
  total_price: z.number(),
  discounted_price: z.number(),
  reservation_price: z.number(),
});

const IndividualPricesSchema = z.object({
  season: IndividualPriceCategorySchema,
  off_season: IndividualPriceCategorySchema,
}).nullable();

export const UpdateToursSchema = z.object({
  localizations: z.array(TranslationSchema).min(1, "At least one localization is required"),
  day: z.string().optional(),
  night: z.string().optional(),
  group_prices: GroupPriceSchema,
  daily: z.boolean().optional().default(false),
  amount_persons: z.number().positive().optional(),
  individual_prices: IndividualPricesSchema,
  type: z.boolean().optional().default(false),
  public: z.boolean().optional().default(false),
  date: z.string().or(z.date()).optional(), 
  image: z.optional(imagePattern.nullable()),
  gallery: z.array(z.string().regex(/^data:image\/[a-zA-Z]+;base64,/)).optional().nullable(),
  deleteImages: z.array(z.string()).optional().nullable(),
});