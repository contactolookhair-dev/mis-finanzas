import { redirect } from "next/navigation";

export default function DeudasPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const query = new URLSearchParams();
  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (typeof value === "string") {
      query.set(key, value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    }
  });

  redirect(query.size > 0 ? `/pendientes?${query.toString()}` : "/pendientes");
}
