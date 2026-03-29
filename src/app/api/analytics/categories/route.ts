import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { getExpenseByCategory } from "@/server/services/analytics-service";
import { categoryMonthlyAnalyticsResponseSchema } from "@/shared/types/category-analytics";

function monthKey(year: number, monthIndex0: number) {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`;
}

function parseMonthParam(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, monthIndex0: month - 1 };
}

function monthBounds(year: number, monthIndex0: number) {
  const start = new Date(year, monthIndex0, 1);
  const endExclusive = new Date(year, monthIndex0 + 1, 1);
  return { start, endExclusive };
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

const querySchema = z.object({
  month: z.string().optional()
});

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId) {
    return NextResponse.json(
      categoryMonthlyAnalyticsResponseSchema.parse({
        month: monthKey(new Date().getFullYear(), new Date().getMonth()),
        previousMonth: monthKey(new Date().getFullYear(), new Date().getMonth() - 1),
        totalExpenses: 0,
        items: []
      })
    );
  }

  const parsedQuery = querySchema.safeParse({
    month: request.nextUrl.searchParams.get("month") ?? undefined
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ message: "Query inválida." }, { status: 400 });
  }

  const now = new Date();
  const requested = parseMonthParam(parsedQuery.data.month ?? null) ?? {
    year: now.getFullYear(),
    monthIndex0: now.getMonth()
  };

  const current = monthBounds(requested.year, requested.monthIndex0);
  const prevDate = new Date(requested.year, requested.monthIndex0 - 1, 1);
  const previous = monthBounds(prevDate.getFullYear(), prevDate.getMonth());

  const [currentRows, previousRows] = await Promise.all([
    getExpenseByCategory({
      workspaceId: context.workspaceId,
      startDate: current.start,
      endDate: current.endExclusive
    }),
    getExpenseByCategory({
      workspaceId: context.workspaceId,
      startDate: previous.start,
      endDate: previous.endExclusive
    })
  ]);

  const previousMap = new Map<string, number>();
  for (const row of previousRows) {
    previousMap.set(row.categoryId ?? "sin-categoria", row.total);
  }

  const totalExpenses = currentRows.reduce((sum, row) => sum + row.total, 0);

  const items = currentRows
    .map((row) => {
      const key = row.categoryId ?? "sin-categoria";
      const prevTotal = previousMap.get(key) ?? 0;
      const delta = row.total - prevTotal;
      const deltaPct = pctChange(row.total, prevTotal);
      const percentage = totalExpenses > 0 ? (row.total / totalExpenses) * 100 : 0;

      return {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        total: row.total,
        percentage,
        count: row.count,
        previousTotal: prevTotal,
        delta,
        deltaPct
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const payload = {
    month: monthKey(requested.year, requested.monthIndex0),
    previousMonth: monthKey(previous.start.getFullYear(), previous.start.getMonth()),
    totalExpenses,
    items
  };

  return NextResponse.json(categoryMonthlyAnalyticsResponseSchema.parse(payload));
}

