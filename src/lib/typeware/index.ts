/**
 * Typeware — validação tipada em runtime (Zod) para Server Actions e patches.
 * Substitui a necessidade de "NgRx selectors" no front: contratos claros na borda.
 */
import { z } from 'zod';

export const ProtocoloSchema = z
  .string()
  .min(5)
  .transform((s) => s.replace(/\D/g, ''))
  .refine((s) => s.length >= 15 && s.length <= 25, 'CNJ inválido');

export const ParadoTratadoPatchSchema = z.object({
  protocolo: z.string().min(5),
  tratado: z.boolean(),
});

export const ReassignOwnerSchema = z.object({
  protocolos: z.array(z.string().min(5)).min(1).max(500),
  novo_created_by: z.string().uuid(),
});

export type ParadoTratadoPatch = z.infer<typeof ParadoTratadoPatchSchema>;
export type ReassignOwnerInput = z.infer<typeof ReassignOwnerSchema>;

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const msg = r.error.issues.map((i) => i.message).join('; ');
    throw new Error(msg || 'Validação typeware falhou');
  }
  return r.data;
}

export function parseSoft<T>(
  schema: z.ZodType<T>,
  data: unknown
): { ok: true; data: T } | { ok: false; error: string } {
  const r = schema.safeParse(data);
  if (!r.success) {
    return { ok: false, error: r.error.issues.map((i) => i.message).join('; ') };
  }
  return { ok: true, data: r.data };
}
