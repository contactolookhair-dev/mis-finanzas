import {
  tryParseFalabellaCmrPdf,
  type FalabellaCmrStatementMeta,
} from "@/server/services/import/pdf-templates/falabella-cmr";
import { extractPdfTextFromBytes } from "@/server/services/import/pdf-text-extractor";

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

function fallbackPlainTextParse(
  _bytes: Uint8Array,
  warning: string
): ParsedPdfImport {
  return {
    rows: [],
    headers: [],
    warnings: [warning],
    supported: false,
  };
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const result = await extractPdfTextFromBytes(bytes);
  if (!result.ok) {
    throw new Error(`${result.error} | ${result.message}`);
  }
  return result.text;
}

export async function parsePdfImportFile(
  bytes: Uint8Array
): Promise<ParsedPdfImport> {
  try {
    const rawText = await extractPdfText(bytes);

    const lines = rawText
      .split(/\r?\n/)
      .map(normalizeLine)
      .filter(Boolean);

    if (!lines.length) {
      return fallbackPlainTextParse(bytes, "PDF sin texto seleccionable");
    }

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

    console.log("[imports/preview] falabella fallback", {
      rawSnippet: rawText.slice(0, 400),
      firstLines: lines.slice(0, 15),
      totalLines: lines.length,
    });

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
