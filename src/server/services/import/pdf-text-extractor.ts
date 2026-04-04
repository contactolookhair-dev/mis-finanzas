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

type PdfParseFn = (buffer: Buffer) => Promise<any>;

let cachedPdfParse: PdfParseFn | null = null;

function resolvePdfParseModule(mod: unknown): PdfParseFn | null {
  if (!mod) return null;
  const candidate = (mod as any).default ?? mod;
  return typeof candidate === "function" ? (candidate as PdfParseFn) : null;
}

async function loadPdfParse(): Promise<PdfParseFn> {
  if (cachedPdfParse) return cachedPdfParse;

  // Guard rail: pdf extraction must run in Node.js runtime.
  // In Edge runtime, some Node internals are missing and pdf-parse will fail.
  const isEdgeRuntime =
    (process.env.NEXT_RUNTIME ?? "").toLowerCase() === "edge" ||
    typeof (globalThis as any).EdgeRuntime !== "undefined";
  if (isEdgeRuntime) {
    throw new Error("pdf_text_extraction_failed:edge_runtime");
  }

  // Prefer the internal entry to avoid bundler interop surprises.
  try {
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    const fn = resolvePdfParseModule(mod);
    if (fn) {
      cachedPdfParse = fn;
      return cachedPdfParse;
    }
  } catch {
    // fall through
  }

  const mod = await import("pdf-parse");
  const fn = resolvePdfParseModule(mod);
  if (!fn) {
    throw new Error("pdf_text_extraction_failed:invalid_pdf_parse_export");
  }

  cachedPdfParse = fn;
  return cachedPdfParse;
}

export async function extractPdfText(
  buffer: Buffer
): Promise<{ text: string; numPages: number; debug: PdfTextExtractionDebug }> {
  const debug: PdfTextExtractionDebug = {
    extractorUsed: null,
    extractorAttempts: [],
    extractorError: null,
  };

  try {
    console.log("[pdf extractor] start", { bufferLength: buffer.length });

    const pdfParse = await loadPdfParse();
    const data = await pdfParse(buffer);

    const text = typeof data?.text === "string" ? data.text : "";
    const numPages = typeof data?.numpages === "number" ? data.numpages : 0;

    const normalized = normalizeExtractedText(text);
    const attempt: PdfTextExtractionAttempt = {
      name: "pdf-parse:default",
      ok: normalized.length > 0,
      textLength: normalized.length,
      numPages,
    };

    debug.extractorAttempts.push(attempt);
    debug.extractorUsed = attempt.ok ? attempt.name : null;

    console.log("[pdf extractor]", {
      textLength: normalized.length,
      numPages,
    });

    return { text: normalized, numPages, debug };
  } catch (error) {
    const attempt: PdfTextExtractionAttempt = {
      name: "pdf-parse:default",
      ok: false,
      textLength: 0,
      numPages: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    };

    debug.extractorAttempts.push(attempt);
    debug.extractorError = attempt.errorMessage ?? "unknown_error";

    console.error("[pdf extractor] failed", {
      errorMessage: attempt.errorMessage,
      errorStack: attempt.errorStack,
    });

    return { text: "", numPages: 0, debug };
  }
}

export async function extractPdfTextFromBytes(
  bytes: Uint8Array
): Promise<PdfTextExtractionResult> {
  try {
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const { text, debug } = await extractPdfText(buffer);
    const normalized = normalizeExtractedText(text);

    if (!normalized || normalized.length < 20) {
      return {
        ok: false,
        error: "pdf_text_empty",
        message:
          "Este PDF no contiene texto seleccionable suficiente para generar la vista previa.",
        debug,
      };
    }

    return { ok: true, text: normalized, debug };
  } catch (error) {
    console.error("[pdf extractor] fatal", {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    return {
      ok: false,
      error: "pdf_text_extraction_failed",
      message: `No se pudo leer el PDF: ${error instanceof Error ? error.message : String(error)
        }`,
      debug: {
        extractorUsed: null,
        extractorAttempts: [],
        extractorError: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
