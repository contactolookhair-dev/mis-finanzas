export function isPublicMode() {
  return process.env.ENABLE_PUBLIC_MODE === "true";
}

export function isDevAuthBypassEnabled() {
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  return !isBuildPhase && process.env.ENABLE_DEV_AUTH_LOGIN === "true" && process.env.NODE_ENV !== "production";
}
