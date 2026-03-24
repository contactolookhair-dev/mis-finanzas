"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
  paymentMethod: z.enum(["EFECTIVO", "DEBITO", "CREDITO", "TRANSFERENCIA", "OTRO"]),
  financialOrigin: z.enum(["PERSONAL", "EMPRESA"]),
  businessUnitId: z.string().optional(),
  categoryId: z.string().optional(),
  isOwed: z.boolean(),
  owedByType: z.enum(["EMPRESA", "PERSONA"]).optional(),
  owedBusinessUnitId: z.string().optional(),
  owedDebtorMode: z.enum(["EXISTING", "NEW"]).optional(),
  owedDebtorId: z.string().optional(),
  owedDebtorName: z.string().optional(),
  owedAmount: z.coerce.number().optional(),
  owedNote: z.string().optional(),
  isBusinessPaidPersonally: z.boolean(),
  notes: z.string().optional()
});

type QuickExpenseValues = z.infer<typeof quickExpenseSchema>;
type DebtorPerson = {
  id: string;
  name: string;
  totalAmount: number;
  notes: string | null;
};
type DebtsPayload = {
  people: DebtorPerson[];
};

const paymentMethodLabel: Record<QuickExpenseValues["paymentMethod"], string> = {
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
  OTRO: "Otro"
};

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function GastosClient() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [debtors, setDebtors] = useState<DebtorPerson[]>([]);
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
      paymentMethod: "DEBITO",
      financialOrigin: "PERSONAL",
      isOwed: false,
      owedByType: "PERSONA",
      owedDebtorMode: "NEW",
      isBusinessPaidPersonally: false,
      businessUnitId: "",
      owedBusinessUnitId: "",
      owedDebtorId: "",
      categoryId: "",
      owedAmount: undefined
    }
  });

  useEffect(() => {
    async function loadReferences() {
      try {
        const [dashboardResponse, debtsResponse] = await Promise.all([
          fetch("/api/dashboard", { cache: "no-store" }),
          fetch("/api/debts", { cache: "no-store" })
        ]);
        if (dashboardResponse.ok) {
          const dashboardPayload = (await dashboardResponse.json()) as DashboardSnapshot;
          setSnapshot(dashboardPayload);
        }
        if (debtsResponse.ok) {
          const debtsPayload = (await debtsResponse.json()) as DebtsPayload;
          setDebtors(debtsPayload.people ?? []);
        }
      } catch {
        // Mantener la pantalla operativa aunque fallen referencias.
      }
    }

    void loadReferences();
  }, []);

  async function upsertPersonDebt(values: QuickExpenseValues, owedAmount: number) {
    if (values.owedDebtorMode === "EXISTING" && values.owedDebtorId) {
      const selectedDebtor = debtors.find((item) => item.id === values.owedDebtorId);
      if (!selectedDebtor) {
        throw new Error("No se encontró la persona seleccionada para la deuda.");
      }
      const patchResponse = await fetch(`/api/debts/${values.owedDebtorId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          totalAmount: Math.max(1, selectedDebtor.totalAmount + owedAmount),
          notes: values.owedNote || selectedDebtor.notes || null
        })
      });
      const patchPayload = (await patchResponse.json()) as { message?: string };
      if (!patchResponse.ok) {
        throw new Error(patchPayload.message ?? "No se pudo actualizar la deuda existente.");
      }
      return;
    }

    const debtorName = values.owedDebtorName?.trim();
    if (!debtorName || debtorName.length < 3) {
      throw new Error("Ingresa el nombre de la persona que te debe este gasto.");
    }

    const createResponse = await fetch("/api/debts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: debtorName,
        reason: values.description,
        totalAmount: owedAmount,
        startDate: values.date,
        estimatedPayDate: null,
        notes: values.owedNote || `Generado desde movimiento manual (${paymentMethodLabel[values.paymentMethod]}).`
      })
    });
    const createPayload = (await createResponse.json()) as { message?: string };
    if (!createResponse.ok) {
      throw new Error(createPayload.message ?? "No se pudo registrar la deuda de la persona.");
    }
  }

  async function onSubmit(values: QuickExpenseValues) {
    setError(null);
    setSaved(null);

    const isCompanyDebt = values.isOwed && values.owedByType === "EMPRESA";
    const isPersonDebt = values.isOwed && values.owedByType === "PERSONA";
    const owedAmount = Math.max(1, Math.abs(values.owedAmount ?? values.amount));
    const notes = [
      `Medio de pago: ${paymentMethodLabel[values.paymentMethod]}`,
      values.notes?.trim(),
      values.isOwed ? `Monto adeudado: ${owedAmount}` : "",
      values.owedNote?.trim()
    ]
      .filter((item) => Boolean(item))
      .join(" · ");

    if (isCompanyDebt && !values.owedBusinessUnitId && !values.businessUnitId) {
      setError("Selecciona la empresa que te debe este gasto.");
      return;
    }

    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...values,
        financialOrigin: isCompanyDebt ? "EMPRESA" : values.financialOrigin,
        businessUnitId: isCompanyDebt ? values.owedBusinessUnitId || values.businessUnitId || null : values.businessUnitId || null,
        categoryId: values.categoryId || null,
        isBusinessPaidPersonally: isCompanyDebt && values.type === "EGRESO",
        isReimbursable: isCompanyDebt && values.type === "EGRESO",
        notes: notes || undefined
      })
    });
    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      setError(payload.message ?? "No se pudo guardar el gasto.");
      return;
    }

    if (isPersonDebt) {
      try {
        await upsertPersonDebt(values, owedAmount);
      } catch (debtError) {
        setSaved("Movimiento guardado, pero faltó registrar/actualizar la deuda pendiente.");
        setError(debtError instanceof Error ? debtError.message : "No se pudo actualizar la deuda pendiente.");
        setTableKey((value) => value + 1);
        return;
      }
    }

    setSaved(values.isOwed ? "Movimiento y deuda pendiente registrados correctamente." : "Gasto registrado correctamente.");
    setTableKey((value) => value + 1);
    reset({
      ...values,
      description: "",
      owedDebtorName: "",
      owedNote: "",
      notes: "",
      amount: undefined,
      owedAmount: undefined
    });
  }

  const financialOrigin = watch("financialOrigin");
  const isOwed = watch("isOwed");
  const owedByType = watch("owedByType");
  const owedDebtorMode = watch("owedDebtorMode");

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card id="agregar-gasto" className="space-y-4 rounded-[24px] p-4 sm:p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Movimientos manuales</p>
          <h2 className="mt-1 text-lg font-semibold">Agregar gasto o ingreso</h2>
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
            <Input placeholder="Ej: Uber, insumos, compra local" {...register("description")} />
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
            <span className="text-xs font-medium text-neutral-600">Medio de pago</span>
            <Select {...register("paymentMethod")}>
              <option value="EFECTIVO">Efectivo</option>
              <option value="DEBITO">Débito</option>
              <option value="CREDITO">Crédito</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="OTRO">Otro</option>
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
          <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 sm:col-span-2">
            <input type="checkbox" {...register("isOwed")} />
            <span className="text-xs text-neutral-600">
              Este gasto lo pagué yo, pero alguien me debe ese dinero
            </span>
          </label>
          {isOwed ? (
            <>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-neutral-600">¿Quién te debe?</span>
                <Select {...register("owedByType")}>
                  <option value="PERSONA">Persona / tarjeta prestada</option>
                  <option value="EMPRESA">Empresa</option>
                </Select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-neutral-600">Monto adeudado</span>
                <Input type="number" step="1" placeholder="12500" {...register("owedAmount")} />
              </label>
              {owedByType === "EMPRESA" ? (
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-medium text-neutral-600">Empresa que debe</span>
                  <Select {...register("owedBusinessUnitId")}>
                    <option value="">Selecciona empresa</option>
                    {snapshot?.references.businessUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : (
                <>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-neutral-600">Registro de deuda</span>
                    <Select {...register("owedDebtorMode")}>
                      <option value="NEW">Crear persona nueva</option>
                      <option value="EXISTING">Sumar a persona existente</option>
                    </Select>
                  </label>
                  {owedDebtorMode === "EXISTING" ? (
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-neutral-600">Persona</span>
                      <Select {...register("owedDebtorId")}>
                        <option value="">Selecciona persona</option>
                        {debtors.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : (
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-neutral-600">Nombre de la persona</span>
                      <Input placeholder="Ej: Camila Rojas" {...register("owedDebtorName")} />
                    </label>
                  )}
                </>
              )}
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-neutral-600">Nota de deuda (opcional)</span>
                <Input placeholder="Ej: Compra farmacia con mi tarjeta" {...register("owedNote")} />
              </label>
            </>
          ) : null}
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

      <div className="space-y-2">
        <h3 className="text-base font-semibold">Movimientos recientes</h3>
        <p className="text-sm text-neutral-500">Registro manual del día a día.</p>
      </div>
      <TransactionsTable key={tableKey} />
    </div>
  );
}
