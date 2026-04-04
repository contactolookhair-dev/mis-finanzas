"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { SectionHeader } from "@/components/ui/section-header";

function buildInitials(input?: string | null) {
  const value = String(input ?? "").trim();
  if (!value) return "?";
  const parts = value.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${second}`.toUpperCase();
}

type ProfilePayload = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
};

export default function PerfilPage() {
  const { data } = useSession();
  const sessionUser = data?.user;

  const sessionLabel = sessionUser?.name ?? sessionUser?.email ?? "";
  const initials = useMemo(() => buildInitials(sessionLabel), [sessionLabel]);

  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/profile", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(payload?.message ?? "No se pudo cargar el perfil.");
      setProfile(payload as ProfilePayload);
      setName(typeof payload?.name === "string" ? payload.name : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el perfil.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const image = profile?.image ?? sessionUser?.image ?? null;
  const email = profile?.email ?? sessionUser?.email ?? null;
  const titleName = profile?.name ?? sessionUser?.name ?? null;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Cuenta"
        title="Perfil"
        description="Edita el nombre visible de tu cuenta. La foto viene desde tu proveedor (por ahora)."
      />

      <SurfaceCard variant="soft" className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-3xl bg-slate-900/90 text-sm font-semibold text-white">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900">
              {titleName ?? email ?? "Mi cuenta"}
            </p>
            {email ? <p className="truncate text-sm text-slate-500">{email}</p> : null}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setSuccess(null);
              setError(null);
              setSaving(true);
              try {
                const res = await fetch("/api/auth/profile", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name })
                });
                const payload = (await res.json().catch(() => null)) as any;
                if (!res.ok) throw new Error(payload?.message ?? "No se pudo guardar.");
                setSuccess("Perfil actualizado.");
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : "No se pudo guardar.");
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Nombre visible
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                disabled={saving}
              />
            </div>

            {error ? (
              <SurfaceCard
                variant="soft"
                padding="sm"
                className="border-rose-200/80 bg-rose-50/80 text-rose-700"
              >
                <p className="text-sm font-medium">{error}</p>
              </SurfaceCard>
            ) : null}

            {success ? (
              <SurfaceCard
                variant="soft"
                padding="sm"
                className="border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
              >
                <p className="text-sm font-medium">{success}</p>
              </SurfaceCard>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="rounded-full" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="rounded-full"
                onClick={() => {
                  setName(profile?.name ?? "");
                  setError(null);
                  setSuccess(null);
                }}
                disabled={saving}
              >
                Descartar
              </Button>
            </div>
          </form>
        )}
      </SurfaceCard>
    </div>
  );
}

