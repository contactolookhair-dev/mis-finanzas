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

function ensurePdfJsGlobals() {
  // Some pdfjs builds rely on these globals existing, even for text extraction.
  // Provide minimal stubs so serverless runtimes don't crash.
  const g = globalThis as any;
  if (typeof g.DOMMatrix === "undefined") g.DOMMatrix = class DOMMatrix {};
  if (typeof g.ImageData === "undefined") g.ImageData = class ImageData {};
  if (typeof g.Path2D === "undefined") g.Path2D = class Path2D {};
}

export async function extractPdfText(buffer: Buffer): Promise<{ text: string; numPages: number }> {
  try {
    ensurePdfJsGlobals();

    // Force CommonJS resolution (no dynamic import, no ESM entry).
    const require = createRequire(import.meta.url);
    const pdfParseMod: unknown = require("pdf-parse");
    const PDFParseCtor =
      pdfParseMod && typeof pdfParseMod === "object" && "PDFParse" in (pdfParseMod as Record<string, unknown>)
        ? (pdfParseMod as Record<string, unknown>).PDFParse
        : null;

    if (typeof PDFParseCtor !== "function") {
      console.error("[pdf extractor] PDFParse ctor not available");
      console.log("[pdf extractor]", { textLength: 0, numPages: 0 });
      return { text: "", numPages: 0 };
    }

    const parser = new (PDFParseCtor as any)({ data: buffer });
    const info = await parser.getInfo().catch(() => null);
    const textResult = await parser.getText();
    await parser.destroy();

    const normalized = normalizeExtractedText(String(textResult?.text ?? ""));
    const numPages =
      info && typeof info === "object" && typeof (info as any).total === "number" ? (info as any).total : 0;

    console.log("[pdf extractor]", { textLength: normalized.length, numPages });
    return { text: normalized, numPages };
  } catch (err) {
    console.error("PDF parse failed", err);
    console.log("[pdf extractor]", { textLength: 0, numPages: 0 });
    return { text: "", numPages: 0 };
  }
}

export async function extractPdfTextFromBytes(bytes: Uint8Array): Promise<PdfTextExtractionResult> {
  try {
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const { text } = await extractPdfText(buffer);
    const normalized = normalizeExtractedText(text);
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
