type AmountLike = {
  amount: number;
  type?: "INGRESO" | "EGRESO" | "ingreso" | "egreso";
};

export function calculateTotalAmount(items: AmountLike[]) {
  return items.reduce((acc, current) => acc + current.amount, 0);
}

export function calculateIncomeExpenseTotals(items: AmountLike[]) {
  return items.reduce(
    (acc, current) => {
      if (current.type?.toUpperCase() === "INGRESO") {
        acc.income += current.amount;
      } else if (current.type?.toUpperCase() === "EGRESO") {
        acc.expense += Math.abs(current.amount);
      } else if (current.amount < 0) {
        acc.expense += Math.abs(current.amount);
      } else {
        acc.income += current.amount;
      }

      acc.net = acc.income - acc.expense;
      return acc;
    },
    { income: 0, expense: 0, net: 0 }
  );
}
