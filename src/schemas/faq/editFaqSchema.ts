import { z } from "zod";

const TranslationSchema = z.object({
  locale: z.string().min(1, "Locale is required"),
  question: z.string().optional(),
  answer: z.string().optional(),
});



export const UpdateFaqSchema = z.object({
  localizations: z.array(TranslationSchema).min(1, "At least one localization is required")
});