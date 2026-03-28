import * as XLSX from "xlsx";
import type { ImportParserKind } from "@/shared/types/imports";
import { parsePdfImportFile } from "@/server/services/import/import-pdf-parser";

export type ParsedImportFile = {
  parser: ImportParserKind;
  rows: Array<Record<string, unknown>>;
  headers: string[];
  warnings: string[];
  supported: boolean;
  meta?: unknown;
};

function getFirstPopulatedSheet(workbook: XLSX.WorkBook) {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: true
    });
    if (rows.length > 0) {
      return rows;
    }
  }
  return [];
}

function detectParser(fileName: string, mimeType: string): ImportParserKind | null {
  const normalized = fileName.toLowerCase();
  if (normalized.endsWith(".csv") || mimeType.includes("csv")) return "csv";
  if (
    normalized.endsWith(".xlsx") ||
    mimeType.includes("spreadsheetml") ||
    mimeType.includes("excel")
  ) {
    return "xlsx";
  }
  if (normalized.endsWith(".pdf") || mimeType.includes("pdf")) return "pdf";
  return null;
}

function looksLikePdfBytes(bytes: Uint8Array) {
  if (bytes.length < 5) return false;
  // %PDF-
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

function normalizeInstallmentText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function detectInstallmentsFromText(text: string): number | null {
  if (!text) return null;

  const normalized = normalizeInstallmentText(text);

  const patterns: RegExp[] = [
    /\b(\d{1,2})\s*cuotas?\b/i,
    /\bcuotas?\s*[:.-]?\s*(\d{1,2})\b/i,
    /\bcuota\s+\d{1,2}\s+de\s+(\d{1,2})\b/i,
    /\b\d{1,2}\s*\/\s*(\d{1,2})\b/i,
    /\b(\d{1,2})x\b/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const value = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(value) && value > 1 && value <= 60) {
      return value;
    }
  }

  return null;
}

function buildInstallmentEnhancedRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    const text = Object.values(row)
      .filter((value) => value !== null && value !== undefined)
      .map((value) => String(value))
      .join(" ");

    const installments = detectInstallmentsFromText(text);

    if (!installments) {
      return row;
    }

    return {
      ...row,
      installments,
      installmentLabel: `${installments} cuotas`
    };
  });
}

export async function parseImportFile(input: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<ParsedImportFile> {
  const parser =
    detectParser(input.fileName, input.mimeType) ??
    (looksLikePdfBytes(input.bytes) ? "pdf" : null);

  if (!parser) {
    throw new Error("Formato de archivo no soportado.");
  }

  if (parser === "pdf") {
    const parsedPdf = await parsePdfImportFile(input.bytes);
    const enhancedRows = buildInstallmentEnhancedRows(parsedPdf.rows);

    return {
      parser,
      rows: enhancedRows,
      headers: parsedPdf.headers,
      warnings: parsedPdf.warnings,
      supported: parsedPdf.supported,
      meta: parsedPdf.meta
    };
  }

  const workbook =
    parser === "csv"
      ? XLSX.read(new TextDecoder("utf-8").decode(input.bytes), {
        type: "string",
        raw: true
      })
      : XLSX.read(input.bytes, { type: "array", raw: true });

  const rows = getFirstPopulatedSheet(workbook);
  const enhancedRows = buildInstallmentEnhancedRows(rows);
  const headers = enhancedRows[0] ? Object.keys(enhancedRows[0]) : [];

  return {
    parser,
    rows: enhancedRows,
    headers,
    warnings: enhancedRows.length === 0 ? ["No se detectaron filas con datos en el archivo."] : [],
    supported: true
  };
}