import { z } from "zod";

const TranslationSchema = z.object({
  locale: z.string().min(1, "Locale is required"),
  start_location: z.string().optional(),
  next_location: z.array(z.string()).optional().default([]),
  description: z.string().optional(),
});

const GroupPriceSchema = z
  .object({
    total_price: z.number().optional(),
    reservation_price: z.number().optional(),
    discounted_price: z.number().optional(),
  })
  .nullable();

const IndividualPriceCategorySchema = z.object({
  total_price: z.number(),
  discounted_price: z.number(),
  reservation_price: z.number(),
});

const IndividualPricesSchema = z.object({
  season: IndividualPriceCategorySchema,
  off_season: IndividualPriceCategorySchema,
}).nullable();

export const CreateToursSchema = z.object({
  localizations: z
    .array(TranslationSchema)
    .min(1, "At least one localization is required"),
  day: z.string().optional(),
  night: z.string().optional(),
  type: z.boolean().optional().default(false),
  date: z.string().or(z.date()).optional(),
  image: z.string().regex(/^data:image\/[a-zA-Z]+;base64,/),
  gallery: z
    .array(z.string().regex(/^data:image\/[a-zA-Z]+;base64,/))
    .optional(),
  amount_persons: z.number().positive().optional(),
  group_prices: GroupPriceSchema.default(null),
  individual_prices: IndividualPricesSchema.default(null),
}).refine(
  (data) => {
    if (data.type === false) {
      return data.group_prices !== null;
    }
    else {
      return data.individual_prices !== null && 
             data.amount_persons !== undefined && 
             data.amount_persons > 0;
    }
  },
  {
    message: "Tour must have valid pricing structure according to its type",
    path: ["type"],
  }
);