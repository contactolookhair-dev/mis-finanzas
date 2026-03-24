const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}
