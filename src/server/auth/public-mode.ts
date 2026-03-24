export function isPublicMode() {
  return process.env.ENABLE_PUBLIC_MODE !== "false";
}

export function isDevAuthBypassEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_AUTH_LOGIN === "true";
}
