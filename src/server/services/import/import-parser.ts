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

export async function parseImportFile(input: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<ParsedImportFile> {
  const parser = detectParser(input.fileName, input.mimeType);
  if (!parser) {
    throw new Error("Formato de archivo no soportado.");
  }

  if (parser === "pdf") {
    const parsedPdf = await parsePdfImportFile(input.bytes);
    return {
      parser,
      rows: parsedPdf.rows,
      headers: parsedPdf.headers,
      warnings: parsedPdf.warnings,
      supported: parsedPdf.supported,
      meta: parsedPdf.meta
    };
  }

  const workbook =
    parser === "csv"
      ? XLSX.read(new TextDecoder("utf-8").decode(input.bytes), { type: "string", raw: true })
      : XLSX.read(input.bytes, { type: "array", raw: true });

  const rows = getFirstPopulatedSheet(workbook);
  const headers = rows[0] ? Object.keys(rows[0]) : [];

  return {
    parser,
    rows,
    headers,
    warnings: rows.length === 0 ? ["No se detectaron filas con datos en el archivo."] : [],
    supported: true
  };
}
