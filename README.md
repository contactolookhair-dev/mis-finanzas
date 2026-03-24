# Mis Finanzas

Aplicación web moderna de finanzas personales e inteligencia financiera para Chile, con control híbrido entre uso personal y unidades de negocio.

## Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- React Hook Form
- Zod
- Recharts

## Primer arranque

```bash
npm install
cp .env.example .env
npm run dev
```

## Prisma

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## Migraciones seguras (harden multi-tenant)

```bash
npm run migrate:harden:precheck
npm run migrate:harden:sanitize
npm run migrate:harden:sanitize:apply
npm run migrate:harden:postcheck
```

Runbook operativo: `docs/runbooks/harden-multitenant-migration.md`

## IA

- `OPENAI_API_KEY`: activa interpretacion y redaccion con LLM real
- `OPENAI_MODEL`: modelo configurable por entorno
- si no hay API key o el provider no esta habilitado, la app usa fallback interno

## Arquitectura base

- `prisma/schema.prisma`: modelos y relaciones núcleo
- `prisma/seed.ts`: semilla inicial para unidades, categorías, cuentas y movimientos
- `src/features/*`: módulos por dominio
- `src/shared/*`: tipos, utilidades y piezas comunes
- `src/server/db`: cliente Prisma
- `src/server/query-builders`: construcción de filtros reutilizables
- `src/server/repositories`: acceso a datos por agregado
- `src/server/services`: casos de uso, analítica y lógica de aplicación
- `src/app/api/ai/query`: endpoint IA financiera interna
- `src/app/api/settings`: endpoint de configuración editable desde la app

## Notas de diseño

- Unidad de negocio en `Transaction` es nullable para soportar "sin asignar"
- Separación explícita entre origen `PERSONAL` y `EMPRESA`
- Montos estandarizados con `Decimal` en capa servidor (`src/server/lib/amounts.ts`)
- Valores operativos cambiantes pensados para gestionarse desde configuración persistida
- Base multi-tenant evolutiva con `Workspace` y contexto opcional por headers
