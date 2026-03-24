# Runbook: Migracion de Endurecimiento Multi-tenant e Idempotencia

Este runbook aplica a la migracion:

- `prisma/migrations/20260324_harden_multitenant_import_idempotency/migration.sql`

Objetivo: aplicar cambios de integridad tenant y deduplicacion de importacion sin romper datos.

## 1) Checklist pre-ejecucion

- Confirmar backup reciente de la base.
- Confirmar variable `DATABASE_URL` del entorno correcto.
- Confirmar ventana de cambio (idealmente bajo trafico).
- Confirmar que la app en ese entorno esté en version que ya incluye:
  - nuevos scripts de precheck/sanitize/postcheck
  - schema Prisma actualizado

## 2) Flujo recomendado por entorno

### Local

```bash
npm run migrate:harden:precheck
npm run migrate:harden:sanitize
npm run migrate:harden:sanitize:apply
npm run migrate:harden:precheck
npx prisma migrate deploy
npm run migrate:harden:postcheck
npm run build
```

### Staging

```bash
npm run migrate:harden:precheck
npm run migrate:harden:sanitize
npm run migrate:harden:sanitize:apply
npm run migrate:harden:precheck
npx prisma migrate deploy
npm run migrate:harden:postcheck
npm run build
```

Validaciones funcionales sugeridas en staging:

1. Importar archivo CSV/XLSX con filas repetidas y confirmar que no duplica transacciones.
2. Ejecutar importaciones concurrentes del mismo archivo y validar idempotencia.
3. Revisar `Movimientos` (endpoint `/api/transactions`) y dashboard.
4. Probar `/api/settings`, `/api/ai/query` y exportes.

### Produccion

```bash
npm run migrate:harden:precheck
npm run migrate:harden:sanitize
npm run migrate:harden:sanitize:apply
npm run migrate:harden:precheck
npx prisma migrate deploy
npm run migrate:harden:postcheck
```

Despues de esto, ejecutar smoke tests funcionales:

1. Login/sesion/workspace activo.
2. Dashboard carga normal.
3. IA responde con datos del workspace.
4. Exportaciones PDF/XLSX funcionan.
5. Importacion de movimientos crea `ImportBatch` y evita duplicados.

## 3) Que valida cada script

- `migrate:harden:precheck`
  - `workspaceId` nulo en tablas tenant-owned
  - slugs duplicados por workspace
  - `duplicateFingerprint` repetido por workspace
  - settings duplicados por workspace/user
  - `userKey` nulo en `UserSettings`

- `migrate:harden:sanitize` (dry-run)
  - muestra bloqueos actuales sin modificar datos

- `migrate:harden:sanitize:apply`
  - backfill `workspaceId` faltante
  - normaliza `userKey` nulos
  - deduplica settings
  - resuelve slugs duplicados (sufijo por `id`)
  - limpia `duplicateFingerprint` repetidos (conserva primer registro)

- `migrate:harden:postcheck`
  - confirma bloqueos en cero
  - confirma indices unicos criticos
  - confirma `workspaceId` no nullable en tablas tenant-owned
  - confirma existencia de `ImportBatch`

## 4) Manejo de conflictos

Si `precheck` o `postcheck` falla:

1. No avanzar al siguiente paso.
2. Ejecutar `migrate:harden:sanitize` para inspeccion.
3. Ejecutar `migrate:harden:sanitize:apply` y repetir `precheck`.
4. Si persiste, revisar manualmente las filas reportadas y corregir antes de continuar.

## 5) Reversibilidad

- Los scripts de saneamiento hacen cambios de datos y deduplicacion.
- Antes de `sanitize:apply` o `migrate deploy`, tomar backup/snapshot.
- Rollback recomendado:
  - restaurar backup del entorno afectado
  - corregir causa del conflicto
  - reintentar flujo completo
