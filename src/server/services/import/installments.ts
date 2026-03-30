export type InstallmentDetection = {
  installmentLabel: string | null;
  cuotaActual: number | null;
  cuotaTotal: number | null;
  cuotasRestantes: number | null;
  isInstallment: boolean;
};

export function detectInstallmentsFromText(text?: string | null): InstallmentDetection {
  const raw = (text ?? "").trim();
  if (!raw) {
    return {
      installmentLabel: null,
      cuotaActual: null,
      cuotaTotal: null,
      cuotasRestantes: null,
      isInstallment: false
    };
  }

  const normalized = raw.toLowerCase();

  // Ignore explicit "sin cuotas"
  if (/\bsin\s+cuotas?\b/.test(normalized)) {
    return {
      installmentLabel: null,
      cuotaActual: null,
      cuotaTotal: null,
      cuotasRestantes: null,
      isInstallment: false
    };
  }

  // Strip full dates like 24/12/2025 so we don't match dd/mm as installments.
  const withoutDates = normalized.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, " ");

  // Bank-style installment ratios: 03/06, 10/12, etc.
  const ratioMatch = withoutDates.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  if (ratioMatch) {
    const actual = Number(ratioMatch[1]);
    const total = Number(ratioMatch[2]);

    // Avoid 01/01 and other non-installment cases.
    if (!Number.isFinite(actual) || !Number.isFinite(total) || total <= 1) {
      return {
        installmentLabel: null,
        cuotaActual: null,
        cuotaTotal: null,
        cuotasRestantes: null,
        isInstallment: false
      };
    }

    return {
      installmentLabel: `${actual}/${total}`,
      cuotaActual: actual,
      cuotaTotal: total,
      cuotasRestantes: Math.max(total - actual, 0),
      isInstallment: true
    };
  }

  // Fallback: "en cuotas" / "cuotas" without a ratio.
  if (/\bcuotas?\b/.test(normalized)) {
    return {
      installmentLabel: "en cuotas",
      cuotaActual: null,
      cuotaTotal: null,
      cuotasRestantes: null,
      isInstallment: true
    };
  }

  return {
    installmentLabel: null,
    cuotaActual: null,
    cuotaTotal: null,
    cuotasRestantes: null,
    isInstallment: false
  };
}

