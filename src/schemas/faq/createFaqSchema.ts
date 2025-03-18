import { z } from "zod";

const TranslationSchema = z.object({
  locale: z.string().min(1, "Locale is required"),
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
});

export const CreateFaqSchema = z.object({
  localizations: z.array(TranslationSchema).min(1, "At least one localization is required"),
 
});