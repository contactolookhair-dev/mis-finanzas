"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Building2, CircleDollarSign, CreditCard } from "lucide-react";
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

const typeIcon: Record<AccountItem["type"], ComponentType<{ className?: string }>> = {
  CREDITO: CreditCard,
  DEBITO: Building2,
  EFECTIVO: CircleDollarSign
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

  const totalAvailable = useMemo(
    () => accounts.reduce((acc, account) => acc + account.balance, 0),
    [accounts]
  );

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
      <Card className="relative overflow-hidden rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-emerald-500 p-5 text-white shadow-[0_26px_48px_rgba(124,58,237,0.28)]">
        <p className="text-xs uppercase tracking-[0.2em] text-white/70">Total disponible</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight">{formatCurrency(totalAvailable)}</p>
        <p className="mt-2 text-xs text-white/80">Suma de todas tus carteras y efectivo.</p>
      </Card>

      <Card className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-soft">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Nueva cartera</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Agregar tarjeta o efectivo</h2>
        </div>
        <form className="grid gap-2.5 sm:grid-cols-2" onSubmit={handleCreate}>
          <Input
            placeholder="Nombre visible"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <Input
            placeholder="Banco"
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
            placeholder="Color opcional (#9333ea)"
            value={form.color}
            onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
          />
          <Input
            placeholder="Icono opcional (💳)"
            value={form.icon}
            onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))}
          />
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={saving || form.name.trim().length < 2}
              className="h-11 w-full rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-emerald-500"
            >
              {saving ? "Guardando..." : "Crear cartera"}
            </Button>
          </div>
        </form>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      </Card>

      <div className="space-y-2">
        {loading ? <Card className="rounded-[20px] p-4 text-sm text-slate-500">Cargando carteras...</Card> : null}
        {!loading && accounts.length === 0 ? (
          <Card className="rounded-[20px] p-4 text-sm text-slate-500">Aún no hay carteras registradas.</Card>
        ) : null}
        {accounts.map((account) => {
          const Icon = typeIcon[account.type];
          return (
            <Card
              key={account.id}
              className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-soft transition hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-white"
                    style={{
                      background: account.color
                        ? account.color
                        : "linear-gradient(135deg, #7c3aed 0%, #ec4899 60%, #10b981 100%)"
                    }}
                  >
                    {account.icon ? <span>{account.icon}</span> : <Icon className="h-5 w-5" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{account.name}</p>
                    <p className="text-xs text-slate-500">
                      {account.bank} · {typeLabel[account.type]}
                    </p>
                  </div>
                </div>
                <p className={`text-base font-semibold ${account.balance >= 0 ? "text-emerald-600" : "text-fuchsia-600"}`}>
                  {formatCurrency(account.balance)}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
