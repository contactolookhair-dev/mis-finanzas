import { Prisma } from "@prisma/client";

export type AmountLike = Prisma.Decimal | number | string;

export function toDecimal(value: AmountLike) {
  if (value instanceof Prisma.Decimal) {
    return value;
  }
  return new Prisma.Decimal(value);
}

export function toAmountNumber(value: AmountLike) {
  return toDecimal(value).toNumber();
}

export function sumAmounts(values: AmountLike[]) {
  return values.reduce<Prisma.Decimal>(
    (acc, current) => acc.plus(toDecimal(current)),
    new Prisma.Decimal(0)
  );
}

export function absAmount(value: AmountLike) {
  return toDecimal(value).abs();
}
