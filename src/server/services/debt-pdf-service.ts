import "server-only";

import PDFDocument from "pdfkit";
import { getDebtsSnapshot } from "@/server/services/debts-service";
import { formatCurrency } from "@/lib/formatters/currency";

type DebtExportKind = "person" | "company";

type DebtExportBundle = {
  fileName: string;
  contentType: string;
  buffer: Buffer;
};

const installmentFrequencyLabel: Record<string, string> = {
  SEMANAL: "Semanal",
  QUINCENAL: "Quincenal",
  MENSUAL: "Mensual",
  ANUAL: "Anual"
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
  doc.fontSize(22).fillColor("#111827").text(title);
  doc.moveDown(0.3).fontSize(10).fillColor("#6b7280").text(subtitle);
  doc.moveDown();
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.4).fontSize(13).fillColor("#0f172a").text(title);
  doc.moveDown(0.2);
}

function drawBulletList(doc: PDFKit.PDFDocument, items: string[]) {
  for (const item of items) {
    doc.fontSize(10).fillColor("#334155").text(`• ${item}`, { indent: 8 });
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-CL");
}

export async function generateDebtPdfBundle(input: {
  workspaceId: string;
  debtId: string;
  kind: DebtExportKind;
}): Promise<DebtExportBundle> {
  const snapshot = await getDebtsSnapshot(input.workspaceId);

  if (input.kind === "person") {
    const debt = snapshot.people.find((item) => item.id === input.debtId);
    if (!debt) {
      throw new Error("Deuda personal no encontrada.");
    }

    const buffer = await createPdfBuffer((doc) => {
      drawHeader(doc, "Detalle de deuda", "Mis Finanzas · reporte limpio y sin IA");
      drawSectionTitle(doc, "Resumen");
      drawBulletList(doc, [
        `Nombre: ${debt.name}`,
        `Motivo: ${debt.reason}`,
        `Monto total: ${formatCurrency(debt.totalAmount)}`,
        `Abonado: ${formatCurrency(debt.paidAmount)}`,
        `Saldo pendiente: ${formatCurrency(debt.pendingAmount)}`,
        `Estado: ${debt.status}`,
        `Inicio: ${formatDate(debt.startDate)}`,
        `Estimado de pago: ${formatDate(debt.estimatedPayDate)}`
      ]);

      drawSectionTitle(doc, "Cuotas");
      if (debt.isInstallmentDebt) {
        drawBulletList(doc, [
          `Modalidad: En cuotas`,
          `Frecuencia: ${installmentFrequencyLabel[debt.installmentFrequency] ?? debt.installmentFrequency}`,
          `Total de cuotas: ${debt.installmentCount}`,
          `Valor por cuota: ${formatCurrency(debt.installmentValue)}`,
          `Cuotas pagadas: ${debt.paidInstallments}`,
          `Cuotas pendientes: ${debt.installmentsPending}`,
          `Progreso: ${debt.paidInstallments}/${debt.installmentCount}`,
          `Próxima cuota: ${formatDate(debt.nextInstallmentDate)}`
        ]);
      } else {
        drawBulletList(doc, ["Modalidad: Pago único"]);
      }

      if (debt.notes) {
        drawSectionTitle(doc, "Notas");
        drawBulletList(doc, [debt.notes]);
      }

      drawSectionTitle(doc, "Historial de abonos");
      if (debt.payments.length === 0) {
        drawBulletList(doc, ["Todavía no hay abonos registrados."]);
      } else {
        drawBulletList(
          doc,
          debt.payments.map(
            (payment) =>
              `${formatDate(payment.paidAt)} · ${formatCurrency(payment.amount)}${
                payment.notes ? ` · ${payment.notes}` : ""
              }`
          )
        );
      }
    });

    return {
      fileName: `deuda-${debt.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
      contentType: "application/pdf",
      buffer
    };
  }

  const debt = snapshot.companies.find((item) => item.id === input.debtId);
  if (!debt) {
    throw new Error("Deuda de empresa no encontrada.");
  }

  const buffer = await createPdfBuffer((doc) => {
    drawHeader(doc, "Detalle de deuda empresarial", "Mis Finanzas · reembolsos y fondos personales");
    drawSectionTitle(doc, "Resumen");
    drawBulletList(doc, [
      `Nombre: ${debt.name}`,
      `Motivo: ${debt.reason}`,
      `Monto total: ${formatCurrency(debt.totalAmount)}`,
      `Abonado: ${formatCurrency(debt.paidAmount)}`,
      `Saldo pendiente: ${formatCurrency(debt.pendingAmount)}`,
      `Estado: ${debt.status}`
    ]);

    drawSectionTitle(doc, "Movimientos asociados");
    if (debt.entries.length === 0) {
      drawBulletList(doc, ["No hay movimientos asociados a esta unidad."]);
    } else {
      drawBulletList(
        doc,
        debt.entries.map(
          (entry) =>
            `${formatDate(entry.createdAt)} · ${formatCurrency(entry.amount)} · ${entry.status}${
              entry.notes ? ` · ${entry.notes}` : ""
            }`
        )
      );
    }
  });

  return {
    fileName: `deuda-empresa-${debt.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
    contentType: "application/pdf",
    buffer
  };
}
