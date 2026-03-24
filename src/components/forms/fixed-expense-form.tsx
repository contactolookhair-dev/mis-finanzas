"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { appConfig } from "@/lib/config/app-config";
import { fixedExpenseSchema } from "@/lib/validators/forms";

type FixedExpenseValues = z.infer<typeof fixedExpenseSchema>;

export function FixedExpenseForm() {
  const [submitted, setSubmitted] = useState<FixedExpenseValues | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FixedExpenseValues>({
    resolver: zodResolver(fixedExpenseSchema),
    defaultValues: {
      frequency: appConfig.fixedExpenseFrequencies[0],
      businessUnit: appConfig.businessUnits.find((unit) => unit.id === "look-hair")?.name ?? appConfig.businessUnits[0].name
    }
  });

  return (
    <Card className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Nuevo gasto fijo</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Formulario listo para conectar con Prisma y acciones del servidor.
        </p>
      </div>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(setSubmitted)}>
        <label className="space-y-2">
          <span className="text-sm font-medium">Nombre</span>
          <Input placeholder="Ej: Arriendo local principal" {...register("name")} />
          {errors.name ? <p className="text-xs text-danger">{errors.name.message}</p> : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Monto ($ CLP)</span>
          <Input type="number" placeholder="780000" {...register("amount")} />
          {errors.amount ? <p className="text-xs text-danger">{errors.amount.message}</p> : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Frecuencia</span>
          <Select {...register("frequency")}>
            {appConfig.fixedExpenseFrequencies.map((frequency) => (
              <option key={frequency}>{frequency}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Día de pago</span>
          <Input type="number" placeholder="5" {...register("dueDate")} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Categoría</span>
          <Select {...register("category")}>
            <option value="">Selecciona</option>
            {appConfig.categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </Select>
          {errors.category ? <p className="text-xs text-danger">{errors.category.message}</p> : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Unidad</span>
          <Select {...register("businessUnit")}>
            {appConfig.businessUnits.map((unit) => (
              <option key={unit.id}>{unit.name}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Cuenta asociada</span>
          <Select {...register("account")}>
            <option value="">Selecciona</option>
            {appConfig.accounts.map((account) => (
              <option key={account}>{account}</option>
            ))}
          </Select>
          {errors.account ? <p className="text-xs text-danger">{errors.account.message}</p> : null}
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">Observaciones</span>
          <Input placeholder="Notas internas, proveedor o regla de pago" {...register("notes")} />
        </label>
        <div className="md:col-span-2">
          <Button type="submit">Guardar borrador</Button>
        </div>
      </form>
      {submitted ? (
        <div className="rounded-3xl bg-accent p-4 text-sm text-primary">
          Validación OK. Próximo paso: persistir con Prisma o server action.
        </div>
      ) : null}
    </Card>
  );
}
