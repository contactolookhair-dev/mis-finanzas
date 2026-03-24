const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}
