export function resolveAssetUrl(value: string | undefined) {
  return value?.startsWith("/assets/") ? "../../public" + value : value;
}
