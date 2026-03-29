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

const require = createRequire(import.meta.url);
// pdf-parse@1.1.1 (CommonJS) - stable on Vercel.
const pdfParse: (buffer: Buffer) => Promise<any> = require("pdf-parse");

export async function extractPdfText(buffer: Buffer): Promise<{ text: string; numPages: number; debug: PdfTextExtractionDebug }> {
  const debug: PdfTextExtractionDebug = {
    extractorUsed: null,
    extractorAttempts: [],
    extractorError: null
  };

  try {
    const data = await pdfParse(buffer);
    const text = typeof data?.text === "string" ? data.text : "";
    const numPages = typeof data?.numpages === "number" ? data.numpages : 0;

    const normalized = normalizeExtractedText(text);
    const attempt: PdfTextExtractionAttempt = {
      name: "pdf-parse:default",
      ok: normalized.length > 0,
      textLength: normalized.length,
      numPages
    };
    debug.extractorAttempts.push(attempt);
    debug.extractorUsed = attempt.ok ? attempt.name : null;

    console.log("[pdf extractor old]", {
      textLength: normalized.length,
      numPages
    });

    return { text: normalized, numPages, debug };
  } catch (error) {
    const attempt: PdfTextExtractionAttempt = {
      name: "pdf-parse:default",
      ok: false,
      textLength: 0,
      numPages: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined
    };
    debug.extractorAttempts.push(attempt);
    debug.extractorError = attempt.errorMessage ?? "unknown_error";
    console.error("[pdf extractor old] failed", error);
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
