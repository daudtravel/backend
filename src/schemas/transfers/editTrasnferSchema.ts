import { z } from "zod";


const TranslationSchema = z.object({
  locale: z.string().min(1, "Locale is required"),
  start_location: z.string().min(1, "Start location is required"),
  end_location: z.string().min(1, "End location is required"),
});


const PriceSchema = z.object({
  season_price: z.number().nullable(),
  off_season_price: z.number().nullable()
});


const VehiclePricesSchema = z.object({
  sedan: PriceSchema,
  minivan: PriceSchema,
  vito: PriceSchema,
  sprinter: PriceSchema,
  bus: PriceSchema
});


export const EditTransferSchema = z.object({
  localizations: z.array(TranslationSchema).min(1, "At least one localization is required"),
  prices: VehiclePricesSchema
});