import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { message: "Ingreso manual deshabilitado en Mis Finanzas." },
    { status: 410 }
  );
}
