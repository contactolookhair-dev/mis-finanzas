import { z } from "zod";
import { appConfig } from "@/lib/config/app-config";

export const fixedExpenseSchema = z.object({
  name: z.string().min(3, "Ingresa un nombre claro"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  frequency: z.string().min(1, "Selecciona la frecuencia"),
  dueDate: z.coerce.number().min(1).max(31),
  category: z.string().min(1, "Selecciona una categoría"),
  businessUnit: z.string().min(1, "Selecciona una unidad"),
  account: z.string().min(1, "Selecciona una cuenta"),
  notes: z.string().optional()
});

export const debtorSchema = z.object({
  name: z.string().min(3, "Ingresa el nombre"),
  reason: z.string().min(3, "Describe el motivo"),
  totalAmount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  paidAmount: z.coerce.number().min(0, "No puede ser negativo"),
  startDate: z.string().min(1, "Selecciona una fecha"),
  estimatedPayDate: z.string().min(1, "Selecciona una fecha estimada"),
  status: z.enum(appConfig.debtorStatuses),
  notes: z.string().optional()
});
