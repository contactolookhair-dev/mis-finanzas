import "pdf-parse/worker";
import {
  tryParseFalabellaCmrPdf,
  type FalabellaCmrStatementMeta,
} from "@/server/services/import/pdf-templates/falabella-cmr";
import { PDFParse } from "pdf-parse";

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
  let parser: PDFParse | null = null;

  try {
    parser = new PDFParse({ data: bytes });
    const result = await parser.getText();

    const normalized = (result?.text ?? "")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!normalized || normalized.length < 20) {
      throw new Error("EMPTY_TEXT");
    }

    return normalized;
  } catch (error) {
    throw new Error(
      `pdf_text_extraction_failed | ${error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    try {
      await parser?.destroy?.();
    } catch {
      // noop
    }
  }
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
      rawSnippet: rawText.slice(0, 200),
      firstLines: lines.slice(0, 5),
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