"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ImportTransactionsPanel } from "@/components/imports/import-transactions-panel";
import { TransactionsTable } from "@/components/tables/transactions-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { DashboardSnapshot } from "@/shared/types/dashboard";

const quickExpenseSchema = z.object({
  date: z.string().min(1, "Ingresa fecha"),
  description: z.string().min(3, "Describe el gasto"),
  amount: z.coerce.number().positive("Monto debe ser mayor a 0"),
  type: z.enum(["INGRESO", "EGRESO"]),
  financialOrigin: z.enum(["PERSONAL", "EMPRESA"]),
  businessUnitId: z.string().optional(),
  categoryId: z.string().optional(),
  isBusinessPaidPersonally: z.boolean(),
  notes: z.string().optional()
});

type QuickExpenseValues = z.infer<typeof quickExpenseSchema>;

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function GastosClient() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(0);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<QuickExpenseValues>({
    resolver: zodResolver(quickExpenseSchema),
    defaultValues: {
      date: getToday(),
      type: "EGRESO",
      financialOrigin: "PERSONAL",
      isBusinessPaidPersonally: false,
      businessUnitId: "",
      categoryId: ""
    }
  });

  useEffect(() => {
    async function loadReferences() {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as DashboardSnapshot;
        setSnapshot(payload);
      } catch {
        // Mantener la pantalla operativa aunque fallen referencias.
      }
    }

    void loadReferences();
  }, []);

  async function onSubmit(values: QuickExpenseValues) {
    setError(null);
    setSaved(null);

    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...values,
        businessUnitId: values.businessUnitId || null,
        categoryId: values.categoryId || null
      })
    });
    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      setError(payload.message ?? "No se pudo guardar el gasto.");
      return;
    }

    setSaved("Gasto registrado correctamente.");
    setTableKey((value) => value + 1);
    reset({
      ...values,
      description: "",
      amount: 0,
      notes: ""
    });
  }

  const financialOrigin = watch("financialOrigin");

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card id="agregar-gasto" className="space-y-4 rounded-[24px] p-4 sm:p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Gastos diarios</p>
          <h2 className="mt-1 text-lg font-semibold">Agregar gasto</h2>
        </div>

        <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-neutral-600">Fecha</span>
            <Input type="date" {...register("date")} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-neutral-600">Monto</span>
            <Input type="number" step="1" placeholder="12500" {...register("amount")} />
            {errors.amount ? <p className="text-xs text-danger">{errors.amount.message}</p> : null}
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-neutral-600">Descripción</span>
            <Input placeholder="Ej: Uber, insumos, publicidad" {...register("description")} />
            {errors.description ? <p className="text-xs text-danger">{errors.description.message}</p> : null}
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-neutral-600">Tipo</span>
            <Select {...register("type")}>
              <option value="EGRESO">Egreso</option>
              <option value="INGRESO">Ingreso</option>
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-neutral-600">Origen</span>
            <Select {...register("financialOrigin")}>
              <option value="PERSONAL">Personal</option>
              <option value="EMPRESA">Empresa</option>
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-neutral-600">Unidad de negocio</span>
            <Select {...register("businessUnitId")}>
              <option value="">Sin asignar</option>
              {snapshot?.references.businessUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-neutral-600">Categoría</span>
            <Select {...register("categoryId")}>
              <option value="">Sin categoría</option>
              {snapshot?.references.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" {...register("isBusinessPaidPersonally")} />
            <span className="text-xs text-neutral-600">
              Marcar como gasto empresarial pagado con fondos personales
            </span>
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-neutral-600">Observaciones (opcional)</span>
            <Input placeholder="Notas internas" {...register("notes")} />
          </label>
          {financialOrigin === "EMPRESA" ? (
            <p className="rounded-xl bg-cyan-50 px-3 py-2 text-xs text-cyan-800 sm:col-span-2">
              Este movimiento quedará clasificado para empresa sin perder trazabilidad del origen.
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar gasto"}
            </Button>
          </div>
        </form>

        {saved ? <p className="text-sm text-emerald-700">{saved}</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </Card>

      <ImportTransactionsPanel />

      <TransactionsTable key={tableKey} />
    </div>
  );
}

