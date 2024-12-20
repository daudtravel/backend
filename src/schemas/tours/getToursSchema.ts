import { z } from "zod";


export const QueryParamsSchema = z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    sortBy: z.enum(['created_at', 'total_price', 'duration']).default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    locale: z.string().min(2).optional().default("ka"),
  });