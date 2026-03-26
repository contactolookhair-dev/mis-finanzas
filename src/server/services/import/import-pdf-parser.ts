import { PDFParse } from "pdf-parse";
import { tryParseFalabellaCmrPdf, type FalabellaCmrStatementMeta } from "@/server/services/import/pdf-templates/falabella-cmr";

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

type HeaderProfile = {
  hasDebit: boolean;
  hasCredit: boolean;
  hasBalance: boolean;
  raw: string | null;
};

const AMOUNT_TOKEN_REGEX = /-?\$?\(?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?\)?|-?\$?\(?\d+(?:,\d{1,2})?\)?/g;
const DATE_AT_START_REGEX = /^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+(.+)$/;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeWhitespace(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeLine(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function parseAmountToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const negative = trimmed.includes("(") || trimmed.startsWith("-");
  const sanitized = trimmed.replace(/[$()\s-]/g, "");
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized.replace(/\./g, "");

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return negative ? -Math.abs(parsed) : parsed;
}

function looksLikeNoise(line: string) {
  const normalized = normalizeText(line);
  if (!normalized) return true;

  return [
    "pagina ",
    "página ",
    "cartola ",
    "estado de cuenta",
    "saldo anterior",
    "saldo inicial",
    "saldo final",
    "total cargos",
    "total abonos",
    "www.",
    "rut ",
    "ejecutivo",
    "sucursal",
    "fecha emision"
  ].some((token) => normalized.includes(token));
}

function detectHeaderProfile(lines: string[]): HeaderProfile {
  for (const line of lines.slice(0, 40)) {
    const normalized = normalizeText(line);
    if (!normalized.includes("fecha")) continue;

    const hasDescription =
      normalized.includes("descripcion") ||
      normalized.includes("descripción") ||
      normalized.includes("detalle") ||
      normalized.includes("glosa") ||
      normalized.includes("concepto");

    const hasDebit =
      normalized.includes("cargo") || normalized.includes("debito") || normalized.includes("débito");
    const hasCredit =
      normalized.includes("abono") ||
      normalized.includes("credito") ||
      normalized.includes("crédito");
    const hasBalance = normalized.includes("saldo");

    if (hasDescription || hasDebit || hasCredit || hasBalance) {
      return {
        hasDebit,
        hasCredit,
        hasBalance,
        raw: line
      };
    }
  }

  return {
    hasDebit: true,
    hasCredit: true,
    hasBalance: true,
    raw: null
  };
}

function mapAmountTokens(tokens: string[], header: HeaderProfile) {
  const amounts = tokens.map(parseAmountToken).filter((value): value is number => value !== null);

  if (amounts.length === 0) {
    return {
      amount: undefined,
      debit: undefined,
      credit: undefined,
      balance: undefined
    };
  }

  if (header.hasDebit && header.hasCredit && header.hasBalance) {
    if (amounts.length >= 3) {
      return {
        amount: undefined,
        debit: Math.abs(amounts[0] ?? 0) > 0 ? Math.abs(amounts[0]) : undefined,
        credit: Math.abs(amounts[1] ?? 0) > 0 ? Math.abs(amounts[1]) : undefined,
        balance: amounts[2]
      };
    }

    if (amounts.length === 2) {
      const [first, second] = amounts;
      return {
        amount: undefined,
        debit: first < 0 ? Math.abs(first) : undefined,
        credit: first > 0 ? Math.abs(first) : undefined,
        balance: second
      };
    }
  }

  if (header.hasBalance && amounts.length >= 2) {
    return {
      amount: amounts[0],
      debit: undefined,
      credit: undefined,
      balance: amounts[amounts.length - 1]
    };
  }

  return {
    amount: amounts[0],
    debit: undefined,
    credit: undefined,
    balance: undefined
  };
}

function tokenizeMovementLine(
  line: string,
  header: HeaderProfile
): (RawRow & { __isMovement: true }) | null {
  const match = line.match(DATE_AT_START_REGEX);
  const dateValue = match?.[1];
  const restValue = match?.[2];
  if (!dateValue || !restValue) {
    return null;
  }

  const rest = restValue.trim();
  const amountTokens = rest.match(AMOUNT_TOKEN_REGEX) ?? [];
  let description = normalizeWhitespace(rest);

  if (amountTokens.length > 0) {
    const lastToken = amountTokens[amountTokens.length - 1];
    const lastIndex = rest.lastIndexOf(lastToken);
    if (lastIndex >= 0) {
      description = normalizeWhitespace(rest.slice(0, lastIndex));
    }
  }

  if (!description || description.length < 2) {
    description = normalizeWhitespace(rest.replace(AMOUNT_TOKEN_REGEX, " "));
  }

  const mapped = mapAmountTokens(amountTokens, header);

  return {
    __isMovement: true,
    fecha: dateValue,
    descripcion: description,
    cargo: mapped.debit,
    abono: mapped.credit,
    monto: mapped.amount,
    saldo: mapped.balance
  };
}

function appendContinuationLine(rows: RawRow[], line: string) {
  const lastRow = rows[rows.length - 1];
  if (!lastRow) return false;
  if (!("descripcion" in lastRow) || typeof lastRow.descripcion !== "string") return false;
  if (looksLikeNoise(line)) return false;
  if (/^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?/.test(line)) return false;

  lastRow.descripcion = normalizeWhitespace(`${lastRow.descripcion} ${line}`);
  return true;
}

export async function parsePdfImportFile(bytes: Uint8Array): Promise<ParsedPdfImport> {
  let parser: PDFParse | null = null;

  try {
    parser = new PDFParse({
      data: Buffer.from(bytes)
    });
    const result = await parser.getText();
    const rawText = result.text ?? "";
    const lines = rawText
      .split(/\r?\n/)
      .map(normalizeLine)
      .filter(Boolean);

    if (lines.length === 0) {
      return {
        rows: [],
        headers: [],
        warnings: [
          "No se detectó texto seleccionable dentro del PDF. Prueba con CSV/XLSX o un PDF exportado con texto."
        ],
        supported: false
      };
    }

    const falabellaCmr = tryParseFalabellaCmrPdf(lines);
    if (falabellaCmr) {
      return {
        rows: falabellaCmr.rows,
        // These "headers" are used for template detection (not for mapping).
        headers: [
          "fecha",
          "descripcion",
          "cargo",
          "abono",
          "tarjeta",
          ...falabellaCmr.headersForDetection
        ],
        warnings: falabellaCmr.warnings,
        supported: falabellaCmr.rows.length > 0,
        meta: {
          kind: "falabella-cmr",
          statement: falabellaCmr.meta
        }
      };
    }

    const header = detectHeaderProfile(lines);
    const rows: RawRow[] = [];

    for (const line of lines) {
      if (looksLikeNoise(line)) {
        continue;
      }

      const movement = tokenizeMovementLine(line, header);
      if (movement) {
        rows.push(movement);
        continue;
      }

      appendContinuationLine(rows, line);
    }

    const warnings: string[] = [];

    if (!header.raw) {
      warnings.push(
        "El PDF se interpretó con heurísticas chilenas genéricas porque no se detectó un encabezado claro."
      );
    }

    if (rows.length === 0) {
      warnings.push(
        "No se pudieron detectar movimientos con suficiente precisión en este PDF. Si puedes, usa CSV/XLSX o revisa otro formato de exportación."
      );
      return {
        rows: [],
        headers: [],
        warnings,
        supported: false
      };
    }

    if (rows.length <= 3) {
      warnings.push(
        "Se detectaron pocos movimientos. Revisa la vista previa con atención porque la confianza del parseo PDF es baja."
      );
    }

    if (rows.some((row) => typeof row.descripcion === "string" && row.descripcion.length > 90)) {
      warnings.push(
        "Algunas glosas venían partidas en varias líneas y se recompusieron automáticamente. Conviene revisarlas antes de guardar."
      );
    }

    return {
      rows,
      headers: ["fecha", "descripcion", "cargo", "abono", "monto", "saldo"],
      warnings,
      supported: true
    };
  } catch (error) {
    return {
      rows: [],
      headers: [],
      warnings: [
        error instanceof Error
          ? `No se pudo leer el PDF: ${error.message}`
          : "No se pudo leer el PDF."
      ],
      supported: false
    };
  } finally {
    if (parser) {
      await parser.destroy().catch(() => undefined);
    }
  }
}
