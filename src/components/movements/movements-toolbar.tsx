"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { ExportActions } from "@/components/exports/export-actions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { DashboardFilters, DashboardSnapshot } from "@/shared/types/dashboard";

function getDefaultRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 29);

  const format = (value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const day = `${value.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    startDate: format(start),
    endDate: format(end)
  };
}

export function MovementsToolbar() {
  const [filters, setFilters] = useState<DashboardFilters>(getDefaultRange());
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);

  useEffect(() => {
    async function loadReferences() {
      try {
        const response = await fetch("/api/dashboard", {
          method: "GET",
          cache: "no-store"
        });
        if (!response.ok) return;
        const payload = (await response.json()) as DashboardSnapshot;
        setSnapshot(payload);
        setFilters(payload.filters);
      } catch {
        // Toolbar de exportación no debe romper la pantalla si falla la carga de referencias.
      }
    }

    void loadReferences();
  }, []);

  return (
    <div className="space-y-4">
      <Card className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="relative xl:col-span-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input className="pl-10" placeholder="Buscar por comercio o descripción" disabled />
        </label>
        <Input
          type="date"
          value={filters.startDate ?? ""}
          onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value || undefined }))}
        />
        <Input
          type="date"
          value={filters.endDate ?? ""}
          onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value || undefined }))}
        />
        <Select
          value={filters.categoryId ?? ""}
          onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value || undefined }))}
        >
          <option value="">Categoría</option>
          {snapshot?.references.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Select
          value={filters.financialOrigin ?? ""}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              financialOrigin: (event.target.value || undefined) as "PERSONAL" | "EMPRESA" | undefined
            }))
          }
        >
          <option value="">Origen</option>
          <option value="PERSONAL">Personal</option>
          <option value="EMPRESA">Empresa</option>
        </Select>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="grid gap-3 md:grid-cols-3">
          <Select
            value={filters.businessUnitId ?? ""}
            onChange={(event) =>
              setFilters((current) => ({ ...current, businessUnitId: event.target.value || undefined }))
            }
          >
            <option value="">Unidad de negocio</option>
            {snapshot?.references.businessUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.reviewStatus ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                reviewStatus: (event.target.value || undefined) as
                  | "PENDIENTE"
                  | "REVISADO"
                  | "OBSERVADO"
                  | undefined
              }))
            }
          >
            <option value="">Estado de revisión</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="REVISADO">Revisado</option>
            <option value="OBSERVADO">Observado</option>
          </Select>
          <Input value="Cuenta no conectada aún" disabled />
        </Card>

        <ExportActions filters={filters} defaultReportType="transactions_filtered" compact />
      </div>
    </div>
  );
}
