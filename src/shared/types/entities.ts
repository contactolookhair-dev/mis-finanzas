import type { Prisma } from "@prisma/client";

export type BusinessUnitEntity = Prisma.BusinessUnitGetPayload<{
  include: {
    accounts: true;
  };
}>;

export type CategoryEntity = Prisma.CategoryGetPayload<{
  include: {
    subcategories: true;
  };
}>;

export type TransactionEntity = Prisma.TransactionGetPayload<{
  include: {
    account: true;
    category: true;
    subcategory: true;
    businessUnit: true;
  };
}>;

export type DebtorEntity = Prisma.DebtorGetPayload<{
  include: {
    payments: true;
  };
}>;

export type ReimbursementEntity = Prisma.ReimbursementGetPayload<{
  include: {
    businessUnit: true;
    personalAccount: true;
    transaction: true;
  };
}>;
