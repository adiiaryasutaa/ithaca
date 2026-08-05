import { z } from 'zod';

export const emailSchema = z.string().email();

export const boundedEmailSchema = z.string().trim().email().max(191);
