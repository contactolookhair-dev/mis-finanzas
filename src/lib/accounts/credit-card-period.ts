function formatYmd(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampDay(year: number, monthIndex: number, day: number) {
  return Math.min(Math.max(1, day), daysInMonth(year, monthIndex));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export type CreditCardBillingPeriod = {
  periodStart: string;
  periodEnd: string;
  lastCloseDate: Date;
  nextCloseDate: Date;
  dueDate: Date | null;
};

export function getCreditCardBillingPeriod(params: {
  now?: Date;
  closingDay: number | null;
  paymentDay: number | null;
}): CreditCardBillingPeriod {
  const now = params.now ?? new Date();
  const closingDay = params.closingDay;
  const paymentDay = params.paymentDay;

  const year = now.getFullYear();
  const month = now.getMonth();

  // Fallback: month-to-date when no closing day configured.
  if (!closingDay || closingDay < 1 || closingDay > 31) {
    const start = new Date(year, month, 1);
    return {
      periodStart: formatYmd(start),
      periodEnd: formatYmd(now),
      lastCloseDate: start,
      nextCloseDate: now,
      dueDate: null
    };
  }

  const thisMonthClose = new Date(year, month, clampDay(year, month, closingDay), 12, 0, 0, 0);
  const thisMonthCloseEnd = new Date(thisMonthClose);
  thisMonthCloseEnd.setHours(23, 59, 59, 999);

  const lastCloseDate =
    now <= thisMonthCloseEnd
      ? new Date(year, month - 1, clampDay(year, month - 1, closingDay), 12, 0, 0, 0)
      : thisMonthClose;

  const nextCloseDate =
    now <= thisMonthCloseEnd
      ? thisMonthClose
      : new Date(year, month + 1, clampDay(year, month + 1, closingDay), 12, 0, 0, 0);

  const periodStartDate = addDays(lastCloseDate, 1);
  const dueDate =
    paymentDay && paymentDay >= 1 && paymentDay <= 31
      ? (() => {
          const dueMonthOffset = paymentDay <= closingDay ? 1 : 0;
          const dueBase = new Date(nextCloseDate);
          dueBase.setMonth(dueBase.getMonth() + dueMonthOffset);
          const dueYear = dueBase.getFullYear();
          const dueMonth = dueBase.getMonth();
          return new Date(dueYear, dueMonth, clampDay(dueYear, dueMonth, paymentDay), 12, 0, 0, 0);
        })()
      : null;

  return {
    periodStart: formatYmd(periodStartDate),
    periodEnd: formatYmd(now),
    lastCloseDate,
    nextCloseDate,
    dueDate
  };
}

