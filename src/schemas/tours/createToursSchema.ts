import { z } from "zod";

const RoomPriceConfig = z.object({
  "1": z.number().optional(), 
  "2": z.number().optional(), 
  "3": z.number().optional(),  
  "4": z.number().optional(),  
  "5": z.number().optional(), 
});

const PersonPriceConfig = z.object({
  "1": z.number().optional(),  
  "2": z.number().optional(),  
  "3": z.number().optional(),  
  "4": z.number().optional(),  
  "5": z.number().optional(),  
  "6": z.number().optional(),  
});

const MonthlyPriceConfig = z.object({
  per_person: PersonPriceConfig,
  room_prices: RoomPriceConfig,
});

const IndividualPriceSchema = z.object({
  "1": MonthlyPriceConfig.optional(),
  "2": MonthlyPriceConfig.optional(),
  "3": MonthlyPriceConfig.optional(),
  "4": MonthlyPriceConfig.optional(),
  "5": MonthlyPriceConfig.optional(),
  "6": MonthlyPriceConfig.optional(),
  "7": MonthlyPriceConfig.optional(),
  "8": MonthlyPriceConfig.optional(),
  "9": MonthlyPriceConfig.optional(),
  "10": MonthlyPriceConfig.optional(),
  "11": MonthlyPriceConfig.optional(),
  "12": MonthlyPriceConfig.optional(),
}).optional();

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
  duration: z.string().optional(),
  group_prices: GroupPriceSchema,
  type: z.boolean().optional().default(false),
  date: z.string().or(z.date()).optional(), 
  individual_prices: IndividualPriceSchema,
  image: z.string().regex(/^data:image\/[a-zA-Z]+;base64,/),
  gallery: z.array(z.string().regex(/^data:image\/[a-zA-Z]+;base64,/)).optional(),
});