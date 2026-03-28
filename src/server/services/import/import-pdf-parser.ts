import { tryParseFalabellaCmrPdf, type FalabellaCmrStatementMeta } from "@/server/services/import/pdf-templates/falabella-cmr";

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

const AMOUNT_TOKEN_REGEX = /\d{1,3}(?:\.\d{3})+/g;
const FULL_DATE_REGEX = /\d{1,2}\/\d{1,2}\/\d{4}/;
const INSTALLMENT_REGEX = /\b(\d{1,2})\/(\d{1,2})\b/;
const MONTH_TEXT_REGEX = /\b[a-z]{3}-\d{4}\b/i;

function normalizeLine(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\?/g, "n")
    .toLowerCase()
    .trim();
}

function fallbackPlainTextParse(_bytes: Uint8Array, warning: string): ParsedPdfImport {
  return {
    rows: [],
    headers: [],
    warnings: [warning],
    supported: false,
  };
}

function parseAmountToken(value: string) {
  const numeric = Number(value.replace(/\./g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function looksLikeNoise(line: string) {
  const normalized = normalizeText(line);
  if (!normalized) return true;
  if (normalized.length <= 2) return true;

  return [
    "estado de cuenta",
    "cliente elite",
    "nombre del titular",
    "cupon de pago",
    "cupon de pago n",
    "resumen",
    "de pago",
    "monto total facturado",
    "monto minimo a pagar",
    "monto mínimo a pagar",
    "cmr puntos",
    "informacion general",
    "información general",
    "cupo total",
    "cupo utilizado",
    "cupo disponible",
    "tasa interes vigente",
    "tasa interés vigente",
    "periodo facturado",
    "período facturado",
    "pagar hasta",
    "detalle",
    "periodo anterior",
    "período anterior",
    "periodo actual",
    "período actual",
    "total operaciones",
    "saldo adeudado",
    "monto facturado",
    "monto pagado",
    "www.",
    "bancofalabella",
    "pagina",
    "página",
    "rut ",
    "cae ",
    "desde hasta",
    "saldo adeudado inicio",
    "saldo adeudado final",
    "monto facturado o a pagar",
    "total cupo",
    "cupo compras",
    "cupo avance",
    "super avance",
    "súper avance",
    "fecha facturacion",
    "fecha facturación",
    "n de contrato",
  ].some((token) => normalized.includes(token));
}

function isLikelyGarbageDescription(description: string) {
  const normalized = normalizeText(description);

  if (!normalized) return true;
  if (normalized.length < 3) return true;

  return [
    "falabella cost t",
    "total",
    "detalle",
    "periodo",
    "periodo actual",
    "periodo anterior",
    "resumen",
    "pago",
    "movimiento",
  ].includes(normalized);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function removeTrailingAmounts(text: string) {
  return text.replace(/(?:\s+\d{1,3}(?:\.\d{3})+)+$/g, "").trim();
}

function cleanMerchantDescription(raw: string) {
  let text = raw;

  text = text
    .replace(/\bS\/I\b/gi, " ")
    .replace(/\bC\/I\b/gi, " ")
    .replace(MONTH_TEXT_REGEX, " ")
    .replace(/\bT\b/g, " ")
    .replace(/\bNACION\b/gi, " ")
    .replace(/\bINT\b/gi, " ")
    .replace(/\bCUOTA\b/gi, " ")
    .replace(/\bCUOTAS\b/gi, " ")
    .replace(/\bCOMPRA EN CUOTAS\b/gi, " ")
    .replace(/\bCOMPRA\b/gi, " ")
    .replace(/\bPAGO\b/gi, " ")
    .replace(/\bSEGURO\b/gi, " ")
    .replace(/\bCOST\b/gi, " ")
    .replace(/\bTOTAL\b/gi, " ")
    .replace(/\bTRANSACCION\b/gi, " ")
    .replace(/\bOPERACION\b/gi, " ")
    .replace(/\bOPERACIONES\b/gi, " ");

  text = text.replace(/\s+/g, " ").trim();
  text = removeTrailingAmounts(text);

  if (!text) return "Movimiento";

  const normalized = normalizeText(text);

  const merchantMap: Array<[string, string]> = [
    ["fundacion america solidaria", "Fundación América Solidaria"],
    ["fundacion solidaria", "Fundación Solidaria"],
    ["homecenter", "Homecenter"],
    ["homcenter", "Homecenter"],
    ["sodimac", "Sodimac"],
    ["falabella", "Falabella"],
    ["tottus", "Tottus"],
    ["uber", "Uber"],
    ["mercado libre", "Mercado Libre"],
    ["mercadolibre", "Mercado Libre"],
    ["spotify", "Spotify"],
    ["netflix", "Netflix"],
    ["google", "Google"],
    ["apple", "Apple"],
    ["shell", "Shell"],
    ["copec", "Copec"],
    ["lipigas", "Lipigas"],
    ["jumbo", "Jumbo"],
    ["lider", "Lider"],
    ["unimarc", "Unimarc"],
    ["santa isabel", "Santa Isabel"],
  ];

  for (const [match, label] of merchantMap) {
    if (normalized.includes(match)) return label;
  }

  return titleCase(text);
}

function classifyMerchant(description: string) {
  const normalized = normalizeText(description);

  if (normalized.includes("falabella")) return "retail";
  if (normalized.includes("homecenter")) return "hogar";
  if (normalized.includes("sodimac")) return "hogar";
  if (normalized.includes("tottus")) return "supermercado";
  if (normalized.includes("jumbo")) return "supermercado";
  if (normalized.includes("lider")) return "supermercado";
  if (normalized.includes("unimarc")) return "supermercado";
  if (normalized.includes("santa isabel")) return "supermercado";
  if (normalized.includes("uber")) return "transporte";
  if (normalized.includes("shell")) return "combustible";
  if (normalized.includes("copec")) return "combustible";
  if (normalized.includes("mercado libre")) return "compras";
  if (normalized.includes("spotify")) return "suscripciones";
  if (normalized.includes("netflix")) return "suscripciones";
  if (normalized.includes("google")) return "suscripciones";
  if (normalized.includes("apple")) return "suscripciones";

  return "sin_categoria";
}

function detectSubscription(description: string) {
  const normalized = normalizeText(description);

  return [
    "spotify",
    "netflix",
    "google",
    "apple",
    "youtube",
    "disney",
    "prime video",
    "amazon prime",
    "chatgpt",
    "openai",
    "icloud",
  ].some((token) => normalized.includes(token));
}

function inferInstallmentAmounts(
  rawMiddle: string,
  montoCuota: number,
  cuotaActual?: number,
  cuotaTotal?: number
) {
  const amounts = (rawMiddle.match(AMOUNT_TOKEN_REGEX) ?? [])
    .map(parseAmountToken)
    .filter((v): v is number => v !== null);

  if (amounts.length === 0) {
    return {
      esCompraEnCuotas: false,
      montoCuota,
      montoTotalCompra: null as number | null,
    };
  }

  const uniqueAmounts = Array.from(new Set(amounts));
  const candidates = uniqueAmounts.filter((value) => value > montoCuota);

  let montoTotalCompra: number | null = null;

  if (candidates.length > 0) {
    montoTotalCompra = Math.max(...candidates);
  } else if (cuotaTotal && cuotaTotal > 1) {
    montoTotalCompra = montoCuota * cuotaTotal;
  }

  const esCompraEnCuotas = Boolean(cuotaActual && cuotaTotal && cuotaTotal > 1);

  return {
    esCompraEnCuotas,
    montoCuota,
    montoTotalCompra,
  };
}

function parseFlexibleLine(line: string) {
  const dateMatch = line.match(FULL_DATE_REGEX);
  if (!dateMatch) return null;

  const fecha = dateMatch[0];

  const amounts = line.match(AMOUNT_TOKEN_REGEX);
  if (!amounts || amounts.length === 0) return null;

  const montoRaw = amounts[amounts.length - 1];
  const montoCuota = parseAmountToken(montoRaw);
  if (montoCuota === null || montoCuota <= 0) return null;

  const start = line.indexOf(fecha) + fecha.length;
  const end = line.lastIndexOf(montoRaw);

  if (end <= start) return null;

  const rawMiddle = line.slice(start, end).trim();
  if (!rawMiddle) return null;

  const installmentMatch = rawMiddle.match(INSTALLMENT_REGEX);
  const cuotaActual = installmentMatch ? Number(installmentMatch[1]) : undefined;
  const cuotaTotal = installmentMatch ? Number(installmentMatch[2]) : undefined;

  const descripcionBase = cleanMerchantDescription(rawMiddle);
  if (isLikelyGarbageDescription(descripcionBase)) return null;

  const categoriaSugerida = classifyMerchant(descripcionBase);
  const esSuscripcion = detectSubscription(descripcionBase);
  const descripcion = descripcionBase;

  const installmentInfo = inferInstallmentAmounts(rawMiddle, montoCuota, cuotaActual, cuotaTotal);

  return {
    __isMovement: true,
    fecha,
    descripcion,
    descripcionBase,
    cargo: montoCuota,
    abono: undefined,
    monto: -montoCuota,
    cuotaActual,
    cuotaTotal,
    installments: cuotaTotal,
    installmentLabel: cuotaTotal ? `${cuotaTotal} cuotas` : undefined,
    esEnCuotas: installmentInfo.esCompraEnCuotas,
    esCompraEnCuotas: installmentInfo.esCompraEnCuotas,
    montoCuota: installmentInfo.montoCuota,
    montoTotalCompra: installmentInfo.montoTotalCompra,
    cuotasRestantes:
      cuotaActual && cuotaTotal && cuotaTotal >= cuotaActual ? cuotaTotal - cuotaActual : undefined,
    categoriaSugerida,
    esSuscripcion,
    bancoDetectado: "falabella",
    rawLine: line,
  };
}

function dedupeRows(rows: RawRow[]) {
  const seen = new Set<string>();
  const result: RawRow[] = [];

  for (const row of rows) {
    const key = [
      String(row.fecha ?? ""),
      String(row.descripcionBase ?? row.descripcion ?? ""),
      String(row.cargo ?? row.monto ?? ""),
      String(row.cuotaActual ?? ""),
      String(row.cuotaTotal ?? ""),
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  let parserInstance:
    | { getText: () => Promise<{ text?: string }>; destroy?: () => Promise<void> | void }
    | null = null;

  try {
    const mod: unknown = await import("pdf-parse").catch((error) => {
      console.error("parsePdfImportFile failed to load pdf-parse", error);
      return null;
    });

    const parserLoaded = Boolean(mod);
    console.log("parsePdfImportFile parserLoaded", { parserLoaded });

    if (!mod) {
      throw new Error("No se pudo cargar la librería pdf-parse");
    }

    const parserFunction =
      typeof mod === "function"
        ? mod
        : mod && typeof (mod as { default?: unknown }).default === "function"
          ? (mod as { default: (buffer: Buffer) => Promise<{ text?: string }> }).default
          : null;

    if (parserFunction) {
      const result = await parserFunction(Buffer.from(bytes));
      console.log("parsePdfImportFile extractedTextLength", { length: typeof result?.text === "string" ? result.text.length : 0 });
      return typeof result?.text === "string" ? result.text : "";
    }

    const moduleRecord = mod as Record<string, unknown> | null;
    const PDFParseCtor =
      moduleRecord && typeof moduleRecord.PDFParse === "function"
        ? (moduleRecord.PDFParse as new (options: { data: Buffer }) => { getText: () => Promise<{ text?: string }>; })
        : moduleRecord &&
          moduleRecord.default &&
          typeof (moduleRecord.default as Record<string, unknown>).PDFParse === "function"
          ? ((moduleRecord.default as Record<string, unknown>).PDFParse as new (options: { data: Buffer }) => {
              getText: () => Promise<{ text?: string }>;
            })
          : null;

    if (!PDFParseCtor) {
      throw new Error("No se encontró una API compatible en pdf-parse");
    }

    parserInstance = new PDFParseCtor({
      data: Buffer.from(bytes),
    });

    if (!parserInstance) {
      throw new Error("No se pudo inicializar el parser de pdf-parse");
    }

    const result = await parserInstance.getText();
    console.log("parsePdfImportFile extractedTextLength", {
      length: typeof result?.text === "string" ? result.text.length : 0
    });
    if (typeof result?.text !== "string") {
      return "";
    }
    return result.text;
  } finally {
    if (parserInstance?.destroy) {
      try {
        await parserInstance.destroy();
      } catch {
        // ignore
      }
    }
  }
}

export async function parsePdfImportFile(bytes: Uint8Array): Promise<ParsedPdfImport> {
  try {
    const rawText = await extractPdfText(bytes);

    console.log("PDF TEXT LENGTH:", rawText.length);

    const lines = rawText
      .split(/\r?\n/)
      .map(normalizeLine)
      .filter(Boolean);

    console.log("LINES:", lines.length);

    if (!lines.length) {
      return fallbackPlainTextParse(bytes, "PDF sin texto seleccionable");
    }

    const falabella = tryParseFalabellaCmrPdf(lines);
    if (falabella && falabella.rows.length > 5) {
      return {
        rows: falabella.rows,
        headers: [
          "fecha",
          "descripcion",
          "cargo",
          "abono",
          "tarjeta",
          ...falabella.headersForDetection,
        ],
        warnings: falabella.warnings,
        supported: true,
        meta: {
          kind: "falabella-cmr",
          statement: falabella.meta,
        },
      };
    }

    const parsedRows: RawRow[] = [];

    for (const line of lines) {
      if (looksLikeNoise(line)) continue;

      const parsed = parseFlexibleLine(line);
      if (!parsed) continue;

      parsedRows.push(parsed);
    }

    const rows = dedupeRows(parsedRows);

    console.log("ROWS DETECTED:", rows.length);

    const warnings: string[] = [];
    if (rows.length < 5) {
      warnings.push("Se detectaron pocos movimientos. Revisa la vista previa.");
    }

    return {
      rows,
      headers: [
        "fecha",
        "descripcion",
        "descripcionBase",
        "cargo",
        "abono",
        "monto",
        "cuotaActual",
        "cuotaTotal",
        "installments",
        "installmentLabel",
        "esEnCuotas",
        "esCompraEnCuotas",
        "montoCuota",
        "montoTotalCompra",
        "cuotasRestantes",
        "categoriaSugerida",
        "esSuscripcion",
        "bancoDetectado",
        "rawLine",
      ],
      warnings,
      supported: rows.length > 0,
    };
  } catch (error) {
    console.error("parsePdfImportFile failed", error);

    return {
      rows: [],
      headers: [],
      warnings: [
        error instanceof Error ? `No se pudo leer el PDF: ${error.message}` : "Error leyendo PDF",
      ],
      supported: false,
    };
  }
}
