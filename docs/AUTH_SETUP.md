# Auth Setup (Auth.js / NextAuth)

This repo uses **NextAuth (Auth.js)** with:
- Google OAuth
- Email/password via Credentials provider (bcrypt)

## Required env vars

Add to `.env.local` (and Vercel env):

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace_with_random_secret

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Notes

- Set `ENABLE_DEV_AUTH_LOGIN="false"` when you want to test real auth locally.
- In production, dev auth bypass is always disabled.

Optional (migration helper for existing single-tenant data):

```bash
LEGACY_USER_KEY=dev-user
```

## Auth tables

Auth tables are created in Postgres as:
- `AuthUser`
- `AuthAccount`
- `AuthJsSession`
- `AuthVerificationToken`

They are managed by `prisma/auth.schema.prisma` and a generated client in:
- `src/server/db/auth-prisma-client`
