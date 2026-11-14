import { z } from 'zod';
export const expenseInput = z.object({
  amount: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, 'Enter a positive amount with up to two decimals.').refine(v => Number(v) > 0, 'Amount must be greater than zero.'),
  category: z.enum(['unknown', 'food', 'waste', 'needs', 'tech', 'self']),
  note: z.string().trim().max(160).default(''),
  spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, 'Enter a valid date.')
});
export function toCents(amount) { const [whole, decimals = ''] = amount.split('.'); return Number(whole) * 100 + Number(decimals.padEnd(2, '0')); }

export const DEFAULT_WORKSPACE = '00000000-0000-4000-8000-000000000001';
export const workspaceId = z.uuid().default(DEFAULT_WORKSPACE);
export const workspaceInput = z.object({ name: z.string().trim().min(1, 'Enter a workspace name.').max(60, 'Use 60 characters or fewer.') });
