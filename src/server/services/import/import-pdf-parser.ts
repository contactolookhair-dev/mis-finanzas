import DOMMatrix from "@thednp/dommatrix";

// 🔥 FIX REAL para Vercel + pdfjs
(global as any).DOMMatrix = DOMMatrix;

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

/**
 * 🔥 EXTRACTOR FINAL ESTABLE PARA VERCEL
 */
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const loadingTask = pdfjs.getDocument({
      data: bytes,
      disableWorker: true, // 🔥 CLAVE
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
    } as any);

    const pdf = await loadingTask.promise;

    const pages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      const strings = content.items
        .map((item: any) => {
          if (typeof item === "string") return item;
          if (typeof item?.str === "string") return item.str;
          return "";
        })
        .filter(Boolean);

      pages.push(strings.join(" "));
    }

    const text = pages.join("\n").trim();

    if (!text || text.length < 20) {
      throw new Error("EMPTY_TEXT");
    }

    console.log("[PDF OK pdfjs] length:", text.length);

    return text;
  } catch (error) {
    console.error("[PDF ERROR pdfjs]", error);

    throw new Error(
      `pdf_text_extraction_failed | ${error instanceof Error ? error.message : String(error)
      }`
    );
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
      return fallbackPlainTextParse(
        bytes,
        "PDF sin texto seleccionable"
      );
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

    // 🔥 fallback básico (igual muestra datos)
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