"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { debtorSchema } from "@/lib/validators/forms";

type DebtorValues = z.infer<typeof debtorSchema>;

export function DebtorForm() {
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<DebtorValues>({
    resolver: zodResolver(debtorSchema),
        defaultValues: {
          status: "Pendiente",
          paidAmount: 0,
          isInstallmentDebt: "no",
          installmentCount: 0,
          installmentValue: 0,
          paidInstallments: 0,
          installmentFrequency: "MENSUAL"
        }
      });

  return (
    <Card className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Nueva cuenta por cobrar</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Registra préstamos, saldos pendientes o cobros asociados a tu operación.
        </p>
      </div>
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={handleSubmit(() => setSaved(true))}
      >
        <label className="space-y-2">
          <span className="text-sm font-medium">Nombre</span>
          <Input placeholder="Ej: Camila Soto" {...register("name")} />
          {errors.name ? <p className="text-xs text-danger">{errors.name.message}</p> : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Motivo</span>
          <Input placeholder="Préstamo, anticipo, reembolso" {...register("reason")} />
          {errors.reason ? <p className="text-xs text-danger">{errors.reason.message}</p> : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Monto total</span>
          <Input type="number" placeholder="350000" {...register("totalAmount")} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Monto abonado</span>
          <Input type="number" placeholder="0" {...register("paidAmount")} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Modalidad</span>
          <Select {...register("isInstallmentDebt")}>
            <option value="no">Pago único</option>
            <option value="si">En cuotas</option>
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Total de cuotas</span>
          <Input type="number" placeholder="12" {...register("installmentCount")} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Valor por cuota</span>
          <Input type="number" placeholder="50000" {...register("installmentValue")} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Cuotas pagadas</span>
          <Input type="number" placeholder="0" {...register("paidInstallments")} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Frecuencia</span>
          <Select {...register("installmentFrequency")}>
            <option value="MENSUAL">Mensual</option>
            <option value="QUINCENAL">Quincenal</option>
            <option value="SEMANAL">Semanal</option>
            <option value="ANUAL">Anual</option>
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Fecha de inicio</span>
          <Input type="date" {...register("startDate")} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Pago estimado</span>
          <Input type="date" {...register("estimatedPayDate")} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Próxima cuota</span>
          <Input type="date" {...register("nextInstallmentDate")} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Estado</span>
          <Select {...register("status")}>
            <option>Pendiente</option>
            <option>Abonando</option>
            <option>Pagado</option>
            <option>Atrasado</option>
          </Select>
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">Observaciones</span>
          <Input placeholder="Compromisos, cuotas o seguimiento" {...register("notes")} />
        </label>
        <div className="md:col-span-2">
          <Button type="submit">Guardar registro</Button>
        </div>
      </form>
      {saved ? (
        <div className="rounded-3xl bg-accent p-4 text-sm text-primary">
          Registro validado. La estructura está lista para agregar historial de abonos.
        </div>
      ) : null}
    </Card>
  );
}
