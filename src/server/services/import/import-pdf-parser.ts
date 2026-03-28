// 🔥 FIX VERCEL DOMMatrix
(global as any).DOMMatrix = class { };

import { tryParseFalabellaCmrPdf, type FalabellaCmrStatementMeta } from "@/server/services/import/pdf-templates/falabella-cmr";

export const runtime = "nodejs";

type RawRow = Record<string, unknown>;

type ParsedPdfImport = {
  rows: RawRow[];
  headers: string[];
  warnings: string[];
  supported: boolean;
  meta?: {
    kind: "falabella-cmr";
    statement: FalabellaCmrStatementMeta;
  };
};

function normalizeLine(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function fallbackPlainTextParse(_bytes: Uint8Array, warning: string): ParsedPdfImport {
  return {
    rows: [],
    headers: [],
    warnings: [warning],
    supported: false,
  };
}

/**
 * 🔥 extractor estable para Vercel
 */
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;

  const buffer = Buffer.from(bytes);
  const result = await pdfParse(buffer);

  const text =
    typeof result?.text === "string"
      ? result.text.trim()
      : "";

  if (!text || text.length < 20) {
    throw new Error("EMPTY_TEXT");
  }

  console.log("[PDF OK] length:", text.length);

  return text;
}

export async function parsePdfImportFile(bytes: Uint8Array): Promise<ParsedPdfImport> {
  try {
    const rawText = await extractPdfText(bytes);

    const lines = rawText
      .split(/\r?\n/)
      .map(normalizeLine)
      .filter(Boolean);

    if (!lines.length) {
      return fallbackPlainTextParse(bytes, "PDF sin texto seleccionable");
    }

    // 🔥 parser Falabella (mantienes inteligencia)
    const falabella = tryParseFalabellaCmrPdf(lines);

    if (falabella && falabella.rows.length > 5) {
      return {
        rows: falabella.rows,
        headers: ["fecha", "descripcion", "cargo", "abono"],
        warnings: falabella.warnings,
        supported: true,
        meta: {
          kind: "falabella-cmr",
          statement: falabella.meta,
        },
      };
    }

    // fallback mínimo
    return {
      rows: lines.map((line, i) => ({
        id: i,
        raw: line,
        description: line,
      })),
      headers: ["raw"],
      warnings: ["Modo fallback activo"],
      supported: true,
    };

  } catch (error) {
    console.error("parsePdfImportFile failed", error);

    return {
      rows: [],
      headers: [],
      warnings: [
        error instanceof Error
          ? `No se pudo leer el PDF: ${error.message}`
          : "Error leyendo PDF",
      ],
      supported: false,
    };
  }
}