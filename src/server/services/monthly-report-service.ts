import "server-only";

import PDFDocument from "pdfkit";
import { getFinancialHealthSnapshot } from "@/server/services/financial-health-service";
import { formatCurrency } from "@/lib/formatters/currency";
import type { DashboardFilters } from "@/shared/types/dashboard";

type MonthlyReportBundle = {
  fileName: string;
  contentType: string;
  buffer: Buffer;
};

function createPdfBuffer(draw: (doc: PDFKit.PDFDocument) => void) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    draw(doc);
    doc.end();
  });
}

function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc
    .fontSize(22)
    .fillColor("#0f172a")
    .text(title);
  doc
    .moveDown(0.25)
    .fontSize(10)
    .fillColor("#64748b")
    .text(subtitle);
  doc.moveDown();
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.5).fontSize(13).fillColor("#0f172a").text(title);
  doc.moveDown(0.2);
}

function drawBulletList(doc: PDFKit.PDFDocument, items: string[]) {
  for (const item of items) {
    doc.fontSize(10).fillColor("#334155").text(`• ${item}`, { indent: 8 });
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function buildMonthLabel(filters: DashboardFilters) {
  const reference = filters.endDate ?? filters.startDate ?? new Date().toISOString().slice(0, 10);
  const date = new Date(`${reference}T12:00:00`);
  return date.toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric"
  });
}

function drawMetricBox(
  doc: PDFKit.PDFDocument,
  input: { x: number; y: number; width: number; title: string; value: string; tone: string }
) {
  const height = 58;
  doc.roundedRect(input.x, input.y, input.width, height, 10).fillAndStroke(input.tone, "#e2e8f0");
  doc.fillColor("#0f172a").fontSize(8).text(input.title, input.x + 10, input.y + 10, {
    width: input.width - 20
  });
  doc.fillColor("#0f172a").fontSize(13).font("Helvetica-Bold").text(input.value, input.x + 10, input.y + 25, {
    width: input.width - 20
  });
}

export async function buildMonthlyReportBundle(input: {
  workspaceId: string;
  filters: DashboardFilters;
}): Promise<MonthlyReportBundle> {
  const health = await getFinancialHealthSnapshot({
    workspaceId: input.workspaceId,
    filters: input.filters
  });

  const monthLabel = buildMonthLabel(input.filters);
  const generatedAt = new Date().toLocaleString("es-CL", {
    dateStyle: "long",
    timeStyle: "short"
  });

  const buffer = await createPdfBuffer((doc) => {
    drawHeader(
      doc,
      `Reporte mensual · ${monthLabel}`,
      "Mis Finanzas · resumen determinista del estado financiero"
    );

    doc
      .roundedRect(40, doc.y, 515, 76, 16)
      .fillAndStroke(
        health.status === "saludable"
          ? "#ecfdf5"
          : health.status === "atencion"
            ? "#fffbeb"
            : "#fef2f2",
        "#e2e8f0"
      );
    doc.fillColor("#0f172a").fontSize(9).text("Estado financiero", 54, doc.y + 12);
    doc.font("Helvetica-Bold").fontSize(20).text(health.headline, 54, doc.y + 28, {
      width: 500
    });
    doc.font("Helvetica").fontSize(10).fillColor("#475569").text(health.summary, 54, doc.y + 52, {
      width: 500
    });
    doc.moveDown(5.2);

    drawSectionTitle(doc, "Resumen mensual");
    const metricY = doc.y + 2;
    drawMetricBox(doc, {
      x: 40,
      y: metricY,
      width: 118,
      title: "Ingresos",
      value: formatCurrency(health.metrics.incomes),
      tone: "#f0fdf4"
    });
    drawMetricBox(doc, {
      x: 169,
      y: metricY,
      width: 118,
      title: "Gastos",
      value: formatCurrency(health.metrics.expenses),
      tone: "#fff1f2"
    });
    drawMetricBox(doc, {
      x: 298,
      y: metricY,
      width: 118,
      title: "Ahorro",
      value: formatCurrency(health.metrics.savings),
      tone: "#eff6ff"
    });
    drawMetricBox(doc, {
      x: 427,
      y: metricY,
      width: 128,
      title: "Semáforo",
      value: `${health.status} · ${health.score}/100`,
      tone: "#f8fafc"
    });
    doc.moveDown(4.4);

    drawSectionTitle(doc, "Top categorías");
    if (health.topCategories.length === 0) {
      drawBulletList(doc, ["No hubo suficientes movimientos categorizados en el período."]);
    } else {
      drawBulletList(
        doc,
        health.topCategories.slice(0, 5).map(
          (item) =>
            `${item.name}: ${formatCurrency(item.amount)} · ${item.percentage.toFixed(1)}% del gasto total`
        )
      );
    }

    drawSectionTitle(doc, "Deudas y compromisos");
    drawBulletList(doc, [
      `Total comprometido en el mes: ${formatCurrency(health.metrics.committedDebtAmount)}`,
      `Cuotas pendientes activas: ${health.metrics.activeInstallmentDebts}`,
      `Próximas cuotas: ${health.metrics.upcomingCount}`,
      `Cuotas vencidas: ${health.metrics.overdueCount}`
    ]);
    if (health.upcomingTimeline.length > 0) {
      drawBulletList(
        doc,
        health.upcomingTimeline.slice(0, 4).map(
          (item) =>
            `${formatDate(item.dueDate)} · ${item.debtName} · ${formatCurrency(item.amount)} · ${item.health === "VENCIDA" ? "vencida" : item.health === "PROXIMA" ? "próxima" : "al día"}`
        )
      );
    }

    drawSectionTitle(doc, "Alertas principales");
    if (health.alerts.length === 0) {
      drawBulletList(doc, ["No se detectaron alertas relevantes en este período."]);
    } else {
      drawBulletList(
        doc,
        health.alerts.slice(0, 5).map((item) => `${item.title}: ${item.description}`)
      );
    }

    drawSectionTitle(doc, "Gastos hormiga");
    if (health.gastosHormiga.length === 0) {
      drawBulletList(doc, ["No se detectaron patrones repetitivos de bajo monto."]);
    } else {
      const totalHormiga = health.gastosHormiga.reduce((sum, item) => sum + item.amount, 0);
      drawBulletList(doc, [`Total acumulado: ${formatCurrency(totalHormiga)}`]);
      drawBulletList(
        doc,
        health.gastosHormiga.slice(0, 5).map(
          (item) =>
            `${item.description} · ${item.count} movimientos · ${formatCurrency(item.amount)}`
        )
      );
    }

    doc.moveDown(1);
    doc.fontSize(9).fillColor("#64748b").text(`Generado el ${generatedAt}`);
  });

  return {
    fileName: `reporte-mensual-${monthLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
    contentType: "application/pdf",
    buffer
  };
}
