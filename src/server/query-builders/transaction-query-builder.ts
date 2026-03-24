import type {
  FinancialOrigin,
  Prisma,
  ReviewStatus,
  TransactionType
} from "@prisma/client";

export type TransactionFilterInput = {
  workspaceId?: string;
  workspaceIds?: string[];
  businessUnitId?: string;
  businessUnitIds?: string[];
  categoryId?: string;
  categoryIds?: string[];
  subcategoryId?: string;
  subcategoryIds?: string[];
  financialOrigin?: FinancialOrigin;
  financialOrigins?: FinancialOrigin[];
  type?: TransactionType;
  types?: TransactionType[];
  reviewStatus?: ReviewStatus;
  reviewStatuses?: ReviewStatus[];
  isBusinessPaidPersonally?: boolean;
  isReimbursable?: boolean;
  startDate?: Date;
  endDate?: Date;
  search?: string;
};

export type TransactionOrderField = "date" | "amount" | "createdAt" | "updatedAt";

export type TransactionOrderInput = {
  field?: TransactionOrderField;
  direction?: Prisma.SortOrder;
};

export function buildTransactionWhere(
  filters: TransactionFilterInput = {}
): Prisma.TransactionWhereInput {
  const workspaceIds = filters.workspaceIds ?? (filters.workspaceId ? [filters.workspaceId] : []);
  const businessUnitIds = filters.businessUnitIds ?? (filters.businessUnitId ? [filters.businessUnitId] : []);
  const categoryIds = filters.categoryIds ?? (filters.categoryId ? [filters.categoryId] : []);
  const subcategoryIds = filters.subcategoryIds ?? (filters.subcategoryId ? [filters.subcategoryId] : []);
  const financialOrigins =
    filters.financialOrigins ?? (filters.financialOrigin ? [filters.financialOrigin] : []);
  const types = filters.types ?? (filters.type ? [filters.type] : []);
  const reviewStatuses =
    filters.reviewStatuses ?? (filters.reviewStatus ? [filters.reviewStatus] : []);

  const andConditions: Prisma.TransactionWhereInput[] = [];

  if (workspaceIds.length > 0) {
    andConditions.push({ workspaceId: { in: workspaceIds } });
  }

  if (businessUnitIds.length > 0) {
    andConditions.push({ businessUnitId: { in: businessUnitIds } });
  }

  if (categoryIds.length > 0) {
    andConditions.push({ categoryId: { in: categoryIds } });
  }

  if (subcategoryIds.length > 0) {
    andConditions.push({ subcategoryId: { in: subcategoryIds } });
  }

  if (financialOrigins.length > 0) {
    andConditions.push({ financialOrigin: { in: financialOrigins } });
  }

  if (types.length > 0) {
    andConditions.push({ type: { in: types } });
  }

  if (reviewStatuses.length > 0) {
    andConditions.push({ reviewStatus: { in: reviewStatuses } });
  }

  if (typeof filters.isBusinessPaidPersonally === "boolean") {
    andConditions.push({ isBusinessPaidPersonally: filters.isBusinessPaidPersonally });
  }

  if (typeof filters.isReimbursable === "boolean") {
    andConditions.push({ isReimbursable: filters.isReimbursable });
  }

  if (filters.startDate || filters.endDate) {
    andConditions.push({
      date: {
        gte: filters.startDate,
        lte: filters.endDate
      }
    });
  }

  if (filters.search && filters.search.trim()) {
    const query = filters.search.trim();
    andConditions.push({
      OR: [
        { description: { contains: query, mode: "insensitive" } },
        { notes: { contains: query, mode: "insensitive" } }
      ]
    });
  }

  if (andConditions.length === 0) {
    return {};
  }

  return { AND: andConditions };
}

export function buildTransactionOrderBy(
  order: TransactionOrderInput = {}
): Prisma.TransactionOrderByWithRelationInput[] {
  const field = order.field ?? "date";
  const direction = order.direction ?? "desc";

  const primary = [{ [field]: direction }] as Prisma.TransactionOrderByWithRelationInput[];

  if (field !== "date") {
    primary.push({ date: "desc" });
  }

  primary.push({ createdAt: "desc" });
  return primary;
}
