import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { getDashboardSnapshot, buildDashboardTransactionFilters } from "@/server/services/dashboard-service";
import { listTransactionsForExport } from "@/server/repositories/transaction-repository";
import { getSummaryByBusinessUnit, getSummaryByCategory, getPersonalMoneyUsedInBusiness } from "@/server/services/analytics-service";
import { getAutomaticInsights } from "@/server/services/insights-service";
import { toAmountNumber } from "@/server/lib/amounts";
import { formatCurrency } from "@/lib/formatters/currency";
import type { DashboardFilters } from "@/shared/types/dashboard";
import type { ExportFormat, ExportReportType } from "@/shared/types/exports";

type ExportBundle = {
  fileName: string;
  contentType: string;
  buffer: Buffer;
};

function formatDateLabel(value: string | undefined) {
  return value ?? "sin fecha";
}

function buildFilterLines(filters: DashboardFilters) {
  return [
    `Período: ${formatDateLabel(filters.startDate)} a ${formatDateLabel(filters.endDate)}`,
    `Unidad de negocio: ${filters.businessUnitId ?? "Todas"}`,
    `Categoría: ${filters.categoryId ?? "Todas"}`,
    `Origen financiero: ${filters.financialOrigin ?? "Todos"}`,
    `Estado de revisión: ${filters.reviewStatus ?? "Todos"}`
  ];
}

function createPdfBuffer(draw: (doc: PDFKit.PDFDocument) => void) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: "A4"
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    draw(doc);
    doc.end();
  });
}

function drawPdfHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc
    .fontSize(22)
    .fillColor("#0f3d3e")
    .text(title);
  doc
    .moveDown(0.3)
    .fontSize(10)
    .fillColor("#6b7280")
    .text(subtitle);
  doc.moveDown();
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.6).fontSize(13).fillColor("#111827").text(title);
  doc.moveDown(0.25);
}

function drawBulletList(doc: PDFKit.PDFDocument, items: string[]) {
  for (const item of items) {
    doc
      .fontSize(10)
      .fillColor("#334155")
      .text(`• ${item}`, {
        indent: 8
      });
  }
}

async function buildDashboardExportData(workspaceId: string, filters: DashboardFilters) {
  const snapshot = await getDashboardSnapshot(workspaceId, filters);
  return snapshot;
}

async function buildTransactionsExportData(workspaceId: string, filters: DashboardFilters) {
  const transactionFilters = buildDashboardTransactionFilters(workspaceId, filters);
  const items = await listTransactionsForExport(transactionFilters);
  return items.map((item) => ({
    fecha: item.date.toISOString().slice(0, 10),
    descripcion: item.description,
    cuenta: item.account?.name ?? "",
    categoria: item.category?.name ?? "Sin categoría",
    subcategoria: item.subcategory?.name ?? "",
    unidad: item.businessUnit?.name ?? "Sin asignar",
    origen: item.financialOrigin,
    tipo: item.type,
    monto: toAmountNumber(item.amount),
    saldo: item.balance ? toAmountNumber(item.balance) : null,
    estadoRevision: item.reviewStatus,
    reembolsable: item.isReimbursable ? "Sí" : "No",
    gastoEmpresarialPagadoPersonalmente: item.isBusinessPaidPersonally ? "Sí" : "No"
  }));
}

async function buildFinancialPeriodExportData(workspaceId: string, filters: DashboardFilters) {
  const snapshot = await getDashboardSnapshot(workspaceId, filters);
  const byCategory = await getSummaryByCategory(buildDashboardTransactionFilters(workspaceId, filters));
  const byBusinessUnit = await getSummaryByBusinessUnit(buildDashboardTransactionFilters(workspaceId, filters));
  return {
    snapshot,
    byCategory,
    byBusinessUnit
  };
}

async function buildBusinessUnitExportData(workspaceId: string, filters: DashboardFilters) {
  return getSummaryByBusinessUnit(buildDashboardTransactionFilters(workspaceId, filters));
}

async function buildPersonalMoneyExportData(workspaceId: string, filters: DashboardFilters) {
  const transactionFilters = buildDashboardTransactionFilters(workspaceId, filters);
  const [summary, insights] = await Promise.all([
    getPersonalMoneyUsedInBusiness(transactionFilters),
    getAutomaticInsights(transactionFilters)
  ]);
  return { summary, insights };
}

async function exportPdf(input: {
  workspaceId: string;
  reportType: ExportReportType;
  filters: DashboardFilters;
}) {
  switch (input.reportType) {
    case "transactions_filtered": {
      const rows = await buildTransactionsExportData(input.workspaceId, input.filters);
      const buffer = await createPdfBuffer((doc) => {
        drawPdfHeader(
          doc,
          "Reporte de movimientos filtrados",
          "Exportado desde Mis Finanzas · Chile"
        );
        drawSectionTitle(doc, "Filtros aplicados");
        drawBulletList(doc, buildFilterLines(input.filters));
        drawSectionTitle(doc, "Resumen");
        drawBulletList(doc, [
          `Movimientos exportados: ${rows.length}`
        ]);
        drawSectionTitle(doc, "Movimientos");
        rows.slice(0, 50).forEach((row) => {
          doc.fontSize(10).fillColor("#111827").text(`${row.fecha} · ${row.descripcion}`);
          doc.fontSize(9).fillColor("#6b7280").text(
            `${row.categoria} · ${row.unidad} · ${formatCurrency(row.monto)}`
          );
          doc.moveDown(0.35);
        });
        if (rows.length > 50) {
          doc.moveDown().fontSize(9).fillColor("#6b7280").text(`Se omitieron ${rows.length - 50} filas en el PDF resumido. Usa Excel para el detalle completo.`);
        }
      });
      return {
        fileName: "movimientos-filtrados.pdf",
        contentType: "application/pdf",
        buffer
      } satisfies ExportBundle;
    }
    case "financial_period": {
      const data = await buildFinancialPeriodExportData(input.workspaceId, input.filters);
      const buffer = await createPdfBuffer((doc) => {
        drawPdfHeader(doc, "Reporte financiero por período", "Resumen ejecutivo exportado desde Mis Finanzas");
        drawSectionTitle(doc, "Filtros aplicados");
        drawBulletList(doc, buildFilterLines(input.filters));
        drawSectionTitle(doc, "KPIs");
        drawBulletList(doc, [
          `Ingresos: ${formatCurrency(data.snapshot.kpis.incomes)}`,
          `Egresos: ${formatCurrency(data.snapshot.kpis.expenses)}`,
          `Flujo neto: ${formatCurrency(data.snapshot.kpis.netFlow)}`,
          `Por cobrar: ${formatCurrency(data.snapshot.kpis.receivables)}`
        ]);
        drawSectionTitle(doc, "Comparativas");
        drawBulletList(doc, [
          `Ingresos vs período anterior: ${data.snapshot.comparisons.incomes.deltaPct.toFixed(1)}%`,
          `Egresos vs período anterior: ${data.snapshot.comparisons.expenses.deltaPct.toFixed(1)}%`,
          `Flujo neto vs período anterior: ${data.snapshot.comparisons.netFlow.deltaPct.toFixed(1)}%`
        ]);
        drawSectionTitle(doc, "Top categorías");
        drawBulletList(
          doc,
          data.byCategory.slice(0, 5).map((item) => `${item.categoryName}: ${formatCurrency(item.expenses)}`)
        );
        drawSectionTitle(doc, "Top unidades de negocio");
        drawBulletList(
          doc,
          data.byBusinessUnit
            .slice(0, 5)
            .map((item) => `${item.businessUnitName}: ${formatCurrency(item.expenses)}`)
        );
      });
      return {
        fileName: "reporte-financiero-periodo.pdf",
        contentType: "application/pdf",
        buffer
      } satisfies ExportBundle;
    }
    case "business_unit_summary": {
      const rows = await buildBusinessUnitExportData(input.workspaceId, input.filters);
      const buffer = await createPdfBuffer((doc) => {
        drawPdfHeader(doc, "Resumen por unidad de negocio", "Reporte consolidado por unidad");
        drawSectionTitle(doc, "Filtros aplicados");
        drawBulletList(doc, buildFilterLines(input.filters));
        drawSectionTitle(doc, "Unidades");
        drawBulletList(
          doc,
          rows.map(
            (item) =>
              `${item.businessUnitName}: ingresos ${formatCurrency(item.incomes)} · egresos ${formatCurrency(item.expenses)} · neto ${formatCurrency(item.net)}`
          )
        );
      });
      return {
        fileName: "resumen-unidades-negocio.pdf",
        contentType: "application/pdf",
        buffer
      } satisfies ExportBundle;
    }
    case "personal_money_summary": {
      const data = await buildPersonalMoneyExportData(input.workspaceId, input.filters);
      const buffer = await createPdfBuffer((doc) => {
        drawPdfHeader(doc, "Dinero personal usado en empresas", "Control de aporte personal a unidades de negocio");
        drawSectionTitle(doc, "Filtros aplicados");
        drawBulletList(doc, buildFilterLines(input.filters));
        drawSectionTitle(doc, "Resumen");
        drawBulletList(doc, [
          `Monto total: ${formatCurrency(data.summary.total)}`,
          `Movimientos detectados: ${data.summary.count}`
        ]);
        drawSectionTitle(doc, "Por unidad de negocio");
        drawBulletList(
          doc,
          data.summary.byBusinessUnit.map(
            (item) => `${item.businessUnitName}: ${formatCurrency(item.total)}`
          )
        );
        if (data.insights.length > 0) {
          drawSectionTitle(doc, "Insights relevantes");
          drawBulletList(doc, data.insights.map((item) => item.title));
        }
      });
      return {
        fileName: "dinero-personal-en-empresas.pdf",
        contentType: "application/pdf",
        buffer
      } satisfies ExportBundle;
    }
    case "dashboard_summary":
    default: {
      const snapshot = await buildDashboardExportData(input.workspaceId, input.filters);
      const buffer = await createPdfBuffer((doc) => {
        drawPdfHeader(doc, "Resumen del dashboard", "Reporte ejecutivo con comparativas e insights");
        drawSectionTitle(doc, "Filtros aplicados");
        drawBulletList(doc, buildFilterLines(snapshot.filters));
        drawSectionTitle(doc, "KPIs principales");
        drawBulletList(doc, [
          `Flujo neto: ${formatCurrency(snapshot.kpis.netFlow)}`,
          `Ingresos: ${formatCurrency(snapshot.kpis.incomes)}`,
          `Egresos: ${formatCurrency(snapshot.kpis.expenses)}`,
          `Dinero personal en empresas: ${formatCurrency(snapshot.kpis.personalMoneyInBusiness)}`,
          `Por cobrar: ${formatCurrency(snapshot.kpis.receivables)}`
        ]);
        drawSectionTitle(doc, "Comparativas");
        drawBulletList(doc, snapshot.comparisons.chart.map((item) => `${item.label}: ${item.deltaPct.toFixed(1)}% vs período anterior`));
        drawSectionTitle(doc, "Insights");
        drawBulletList(doc, snapshot.insights.map((item) => item.title));
      });
      return {
        fileName: "dashboard-financiero.pdf",
        contentType: "application/pdf",
        buffer
      } satisfies ExportBundle;
    }
  }
}

function appendSheet(workbook: XLSX.WorkBook, name: string, rows: Array<Record<string, unknown>>) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

async function exportExcel(input: {
  workspaceId: string;
  reportType: ExportReportType;
  filters: DashboardFilters;
}) {
  const workbook = XLSX.utils.book_new();

  switch (input.reportType) {
    case "transactions_filtered": {
      const rows = await buildTransactionsExportData(input.workspaceId, input.filters);
      appendSheet(workbook, "Movimientos", rows);
      break;
    }
    case "financial_period": {
      const data = await buildFinancialPeriodExportData(input.workspaceId, input.filters);
      appendSheet(workbook, "KPIs", [
        {
          ingresos: data.snapshot.kpis.incomes,
          egresos: data.snapshot.kpis.expenses,
          flujoNeto: data.snapshot.kpis.netFlow,
          dineroPersonalEnEmpresas: data.snapshot.kpis.personalMoneyInBusiness,
          porCobrar: data.snapshot.kpis.receivables
        }
      ]);
      appendSheet(workbook, "Por categoría", data.byCategory);
      appendSheet(workbook, "Por negocio", data.byBusinessUnit);
      appendSheet(workbook, "Comparativas", data.snapshot.comparisons.chart);
      break;
    }
    case "business_unit_summary": {
      const rows = await buildBusinessUnitExportData(input.workspaceId, input.filters);
      appendSheet(workbook, "Unidades", rows);
      break;
    }
    case "personal_money_summary": {
      const data = await buildPersonalMoneyExportData(input.workspaceId, input.filters);
      appendSheet(workbook, "Resumen", [
        {
          total: data.summary.total,
          count: data.summary.count
        }
      ]);
      appendSheet(workbook, "Por unidad", data.summary.byBusinessUnit);
      appendSheet(workbook, "Insights", data.insights);
      break;
    }
    case "dashboard_summary":
    default: {
      const snapshot = await buildDashboardExportData(input.workspaceId, input.filters);
      appendSheet(workbook, "KPIs", [
        {
          flujoNeto: snapshot.kpis.netFlow,
          ingresos: snapshot.kpis.incomes,
          egresos: snapshot.kpis.expenses,
          dineroPersonalEnEmpresas: snapshot.kpis.personalMoneyInBusiness,
          porCobrar: snapshot.kpis.receivables,
          movimientos: snapshot.kpis.totalTransactions
        }
      ]);
      appendSheet(workbook, "Comparativas", snapshot.comparisons.chart);
      appendSheet(workbook, "Tendencia", snapshot.charts.trend);
      appendSheet(workbook, "Categorías", snapshot.charts.categories);
      appendSheet(workbook, "Negocios", snapshot.charts.businessUnits);
      appendSheet(workbook, "Insights", snapshot.insights);
      break;
    }
  }

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  }) as Buffer;

  return {
    fileName: `${input.reportType}.xlsx`,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer
  } satisfies ExportBundle;
}

export async function generateExportBundle(input: {
  workspaceId: string;
  format: ExportFormat;
  reportType: ExportReportType;
  filters: DashboardFilters;
}) {
  if (input.format === "pdf") {
    return exportPdf(input);
  }

  return exportExcel(input);
}
