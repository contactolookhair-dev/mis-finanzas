import { z } from "zod";
import { dashboardFiltersSchema } from "@/shared/types/dashboard";

export const exportFormatSchema = z.enum(["pdf", "xlsx"]);
export const exportReportTypeSchema = z.enum([
  "dashboard_summary",
  "transactions_filtered",
  "financial_period",
  "business_unit_summary",
  "personal_money_summary"
]);

export const exportRequestSchema = z.object({
  format: exportFormatSchema,
  reportType: exportReportTypeSchema,
  filters: dashboardFiltersSchema.default({})
});

export type ExportFormat = z.infer<typeof exportFormatSchema>;
export type ExportReportType = z.infer<typeof exportReportTypeSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
