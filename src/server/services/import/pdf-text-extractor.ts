import { createRequire } from "module";

export type PdfTextExtractionResult =
  | { ok: true; text: string; debug: PdfTextExtractionDebug }
  | {
    ok: false;
    error: "pdf_text_extraction_failed" | "pdf_text_empty";
    message: string;
    debug: PdfTextExtractionDebug;
  };

export type PdfTextExtractionAttempt = {
  name: "pdf-parse:default" | "pdf-parse:useSystemFonts";
  ok: boolean;
  textLength: number;
  numPages: number;
  errorMessage?: string;
  errorStack?: string;
};

export type PdfTextExtractionDebug = {
  extractorUsed: PdfTextExtractionAttempt["name"] | null;
  extractorAttempts: PdfTextExtractionAttempt[];
  extractorError: string | null;
};

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

async function tryExtractWithPdfParse(buffer: Buffer, opts: { useSystemFonts?: boolean }) {
  ensurePdfJsGlobals();
  const require = createRequire(import.meta.url);
  const pdfParseMod: unknown = require("pdf-parse");
  const PDFParseCtor =
    pdfParseMod && typeof pdfParseMod === "object" && "PDFParse" in (pdfParseMod as Record<string, unknown>)
      ? (pdfParseMod as Record<string, unknown>).PDFParse
      : null;

  if (typeof PDFParseCtor !== "function") {
    throw new Error("pdf_parse_ctor_missing");
  }

  const parser = new (PDFParseCtor as any)({ data: buffer, ...(opts.useSystemFonts ? { useSystemFonts: true } : {}) });
  const info = await parser.getInfo().catch(() => null);
  const textResult = await parser.getText();
  await parser.destroy();

  const normalized = normalizeExtractedText(String(textResult?.text ?? ""));
  const numPages =
    info && typeof info === "object" && typeof (info as any).total === "number" ? (info as any).total : 0;

  return { text: normalized, numPages };
}

export async function extractPdfText(buffer: Buffer): Promise<{ text: string; numPages: number; debug: PdfTextExtractionDebug }> {
  const debug: PdfTextExtractionDebug = {
    extractorUsed: null,
    extractorAttempts: [],
    extractorError: null
  };

  console.log("[pdf extractor] start", { bufferLength: buffer.length });

  try {
    // Attempt A: default settings
    try {
      const { text, numPages } = await tryExtractWithPdfParse(buffer, { useSystemFonts: false });
      const attempt: PdfTextExtractionAttempt = {
        name: "pdf-parse:default",
        ok: text.length > 0,
        textLength: text.length,
        numPages
      };
      debug.extractorAttempts.push(attempt);
      console.log("[pdf extractor]", { attempt: attempt.name, textLength: attempt.textLength, numPages: attempt.numPages });
      if (text.length > 200) {
        debug.extractorUsed = attempt.name;
        return { text, numPages, debug };
      }
    } catch (err) {
      const attempt: PdfTextExtractionAttempt = {
        name: "pdf-parse:default",
        ok: false,
        textLength: 0,
        numPages: 0,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined
      };
      debug.extractorAttempts.push(attempt);
      debug.extractorError = attempt.errorMessage ?? "unknown_error";
      console.error("PDF parse failed (default)", err);
    }

    // Attempt B: system fonts enabled (can fix empty text in minimal serverless images)
    try {
      const { text, numPages } = await tryExtractWithPdfParse(buffer, { useSystemFonts: true });
      const attempt: PdfTextExtractionAttempt = {
        name: "pdf-parse:useSystemFonts",
        ok: text.length > 0,
        textLength: text.length,
        numPages
      };
      debug.extractorAttempts.push(attempt);
      console.log("[pdf extractor]", { attempt: attempt.name, textLength: attempt.textLength, numPages: attempt.numPages });
      if (text.length > 200) {
        debug.extractorUsed = attempt.name;
        return { text, numPages, debug };
      }
    } catch (err) {
      const attempt: PdfTextExtractionAttempt = {
        name: "pdf-parse:useSystemFonts",
        ok: false,
        textLength: 0,
        numPages: 0,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined
      };
      debug.extractorAttempts.push(attempt);
      debug.extractorError = attempt.errorMessage ?? debug.extractorError ?? "unknown_error";
      console.error("PDF parse failed (useSystemFonts)", err);
    }

    console.log("[pdf extractor] done", { textLength: 0, numPages: 0 });
    return { text: "", numPages: 0, debug };
  } catch (err) {
    debug.extractorError = err instanceof Error ? err.message : String(err);
    console.error("PDF parse failed", err);
    console.log("[pdf extractor] done", { textLength: 0, numPages: 0 });
    return { text: "", numPages: 0, debug };
  }
}

export async function extractPdfTextFromBytes(bytes: Uint8Array): Promise<PdfTextExtractionResult> {
  try {
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const { text, debug } = await extractPdfText(buffer);
    const normalized = normalizeExtractedText(text);
    if (!normalized || normalized.length < 20) {
      return {
        ok: false,
        error: "pdf_text_empty",
        message: "Este PDF no contiene texto seleccionable suficiente para generar la vista previa.",
        debug
      };
    }

    return { ok: true, text: normalized, debug };
  } catch (error) {
    return {
      ok: false,
      error: "pdf_text_extraction_failed",
      message: `No se pudo leer el PDF: ${error instanceof Error ? error.message : String(error)}`,
      debug: {
        extractorUsed: null,
        extractorAttempts: [],
        extractorError: error instanceof Error ? error.message : String(error)
      }
    };
  }
}
