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
    const pdfParseMod: unknown = require("pdf-parse");
    const PDFParseCtor =
      pdfParseMod && typeof pdfParseMod === "object" && "PDFParse" in (pdfParseMod as Record<string, unknown>)
        ? (pdfParseMod as Record<string, unknown>).PDFParse
        : null;

    if (typeof PDFParseCtor !== "function") {
      return {
        ok: false,
        error: "pdf_text_extraction_failed",
        message: "No se pudo cargar el lector de PDF."
      };
    }

    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const parser = new (PDFParseCtor as any)({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();

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
