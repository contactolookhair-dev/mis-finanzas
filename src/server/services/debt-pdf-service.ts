import { PdfReader } from "pdfreader";

import {
  tryParseFalabellaCmrPdf,
  type FalabellaCmrStatementMeta,
} from "@/server/services/import/pdf-templates/falabella-cmr";

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
  return new Promise((resolve, reject) => {
    const reader = new PdfReader();
    let text = "";

    reader.parseBuffer(Buffer.from(bytes), (err, item) => {
      if (err) {
        reject(err);
      } else if (!item) {
        if (!text || text.length < 20) {
          reject(new Error("EMPTY_TEXT"));
        } else {
          resolve(text);
        }
      } else if (item.text) {
        text += item.text + "\n";
      }
    });
  });
}

export async function parsePdfImportFile(
  bytes: Uint8Array
): Promise<ParsedPdfImport> {
  try {
    const rawText = await extractPdfText(bytes);

    const lines = rawText
      .split("\n")
      .map(normalizeLine)
      .filter(Boolean);

    if (!lines.length) {
      return fallbackPlainTextParse(
        bytes,
        "PDF sin texto seleccionable"
      );
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