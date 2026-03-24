"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { appConfig } from "@/lib/config/app-config";
import { Select } from "@/components/ui/select";

export function BusinessUnitSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("unidad") ?? "consolidado";

  return (
    <Select
      value={current}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("unidad", event.target.value);
        router.push(`${pathname}?${params.toString()}` as Route);
      }}
      className="h-10 min-w-[150px] text-xs sm:min-w-[170px] sm:text-sm"
    >
      {appConfig.businessUnits.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {unit.name}
        </option>
      ))}
    </Select>
  );
}
