"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters/currency";

type AccountItem = {
  id: string;
  name: string;
  bank: string;
  type: "CREDITO" | "DEBITO" | "EFECTIVO";
  balance: number;
  color: string | null;
  icon: string | null;
};

type AccountsPayload = {
  items: AccountItem[];
};

const typeLabel: Record<AccountItem["type"], string> = {
  CREDITO: "Crédito",
  DEBITO: "Débito",
  EFECTIVO: "Efectivo"
};

export function CuentasClient() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    bank: "",
    type: "DEBITO" as AccountItem["type"],
    openingBalance: "",
    color: "",
    icon: ""
  });

  async function loadAccounts() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/accounts", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudieron cargar las cuentas.");
      const payload = (await response.json()) as AccountsPayload;
      setAccounts(payload.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error cargando cuentas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          bank: form.bank || null,
          type: form.type,
          openingBalance: form.openingBalance === "" ? undefined : Number(form.openingBalance),
          color: form.color || undefined,
          icon: form.icon || undefined
        })
      });
      const body = (await response.json()) as AccountsPayload & { message?: string };
      if (!response.ok) throw new Error(body.message ?? "No se pudo crear la cuenta.");
      setAccounts(body.items);
      setForm({
        name: "",
        bank: "",
        type: "DEBITO",
        openingBalance: "",
        color: "",
        icon: ""
      });
      setSuccess("Cuenta creada correctamente.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear la cuenta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card className="space-y-4 rounded-[24px] p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Cuentas manuales</p>
          <h2 className="mt-1 text-lg font-semibold">Tarjetas y efectivo</h2>
        </div>
        <form className="grid gap-2.5 sm:grid-cols-2" onSubmit={handleCreate}>
          <Input
            placeholder="Nombre visible"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <Input
            placeholder="Banco (opcional)"
            value={form.bank}
            onChange={(event) => setForm((current) => ({ ...current, bank: event.target.value }))}
          />
          <Select
            value={form.type}
            onChange={(event) =>
              setForm((current) => ({ ...current, type: event.target.value as AccountItem["type"] }))
            }
          >
            <option value="DEBITO">Débito</option>
            <option value="CREDITO">Crédito</option>
            <option value="EFECTIVO">Efectivo</option>
          </Select>
          <Input
            type="number"
            placeholder="Saldo inicial (opcional)"
            value={form.openingBalance}
            onChange={(event) =>
              setForm((current) => ({ ...current, openingBalance: event.target.value }))
            }
          />
          <Input
            placeholder="Color (opcional, ej: #22c55e)"
            value={form.color}
            onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
          />
          <Input
            placeholder="Icono (opcional, ej: 💳)"
            value={form.icon}
            onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))}
          />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving || form.name.trim().length < 2}>
              {saving ? "Guardando..." : "Crear cuenta"}
            </Button>
          </div>
        </form>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      </Card>

      <Card className="rounded-[24px] p-4">
        <h3 className="text-base font-semibold">Saldo actual por cuenta</h3>
        <p className="mt-1 text-sm text-neutral-500">
          El saldo se calcula automáticamente con tus movimientos manuales.
        </p>
        <div className="mt-3 space-y-2">
          {loading ? <p className="text-sm text-neutral-500">Cargando cuentas...</p> : null}
          {!loading && accounts.length === 0 ? (
            <p className="text-sm text-neutral-500">Aún no hay cuentas registradas.</p>
          ) : null}
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-3"
            >
              <div>
                <p className="text-sm font-semibold">
                  {account.icon ? `${account.icon} ` : ""}
                  {account.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {account.bank} · {typeLabel[account.type]}
                </p>
              </div>
              <p className="text-sm font-semibold">{formatCurrency(account.balance)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
