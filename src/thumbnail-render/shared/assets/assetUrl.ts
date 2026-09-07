export function resolveAssetUrl(value: string | undefined) {
  if (!value?.startsWith("/assets/")) return value;
  if (window.location.protocol !== "file:") return value;
  return new URL("../../public" + value, window.location.href).href;
}
