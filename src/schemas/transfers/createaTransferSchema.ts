import { z } from "zod";

// Define the price structure schema for each vehicle type
const PriceSchema = z.object({
  season_price: z.number().nullable(),
  off_season_price: z.number().nullable()
});

// Define the vehicles price schema
const VehiclePricesSchema = z.object({
  sedan: PriceSchema,
  minivan: PriceSchema,
  vito: PriceSchema,
  sprinter: PriceSchema,
  bus: PriceSchema
});

// Define the translation schema for localizations
const TranslationSchema = z.object({
  locale: z.string().min(1, "Locale is required"),
  start_location: z.string().min(1, "Start location is required"),
  end_location: z.string().min(1, "End location is required"),
});

// Define the main transfer schema
export const CreateTransfersSchema = z.object({
  localizations: z.array(TranslationSchema).min(1, "At least one localization is required"),
  prices: VehiclePricesSchema
});