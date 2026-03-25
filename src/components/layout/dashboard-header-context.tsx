"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type HeaderMetricTone = "neutral" | "positive" | "negative";

export type DashboardHeaderMetric = {
  label: string;
  value: string;
  detail?: string;
  tone?: HeaderMetricTone;
};

type DashboardHeaderContextValue = {
  metric: DashboardHeaderMetric | null;
  setMetric: (metric: DashboardHeaderMetric | null) => void;
};

const DashboardHeaderContext = createContext<DashboardHeaderContextValue | null>(null);

export function DashboardHeaderProvider({ children }: { children: ReactNode }) {
  const [metric, setMetric] = useState<DashboardHeaderMetric | null>(null);

  const value = useMemo(
    () => ({
      metric,
      setMetric
    }),
    [metric]
  );

  return <DashboardHeaderContext.Provider value={value}>{children}</DashboardHeaderContext.Provider>;
}

export function useDashboardHeader() {
  const context = useContext(DashboardHeaderContext);

  if (!context) {
    throw new Error("useDashboardHeader must be used within DashboardHeaderProvider");
  }

  return context;
}
