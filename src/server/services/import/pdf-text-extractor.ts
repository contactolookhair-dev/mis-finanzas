import { createRequire } from "module";

export type PdfTextExtractionResult =
  | { ok: true; text: string }
  | { ok: false; error: "pdf_text_extraction_failed" | "pdf_text_empty"; message: string };

function normalizeExtractedText(value: string) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdfTextFromBytes(bytes: Uint8Array): Promise<PdfTextExtractionResult> {
  try {
    const require = createRequire(import.meta.url);
    // `pdf-parse/node` is exported and resolves to the stable CJS build for Node runtimes.
    const pdfParse: unknown = require("pdf-parse/node");
    if (typeof pdfParse !== "function") {
      return {
        ok: false,
        error: "pdf_text_extraction_failed",
        message: "No se pudo cargar el lector de PDF."
      };
    }

    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const result = await (pdfParse as (buffer: Buffer) => Promise<{ text?: unknown }>)(buffer);

    const normalized = normalizeExtractedText(String(result?.text ?? ""));
    if (!normalized || normalized.length < 20) {
      return {
        ok: false,
        error: "pdf_text_empty",
        message: "Este PDF no contiene texto seleccionable suficiente para generar la vista previa."
      };
    }

    return { ok: true, text: normalized };
  } catch (error) {
    return {
      ok: false,
      error: "pdf_text_extraction_failed",
      message: `No se pudo leer el PDF: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

