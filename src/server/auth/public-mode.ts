export function isPublicMode() {
  return process.env.ENABLE_PUBLIC_MODE !== "false";
}
