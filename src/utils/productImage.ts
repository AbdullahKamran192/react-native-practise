const PUBLIC_IMAGES_BASE_URL = "https://pub-2ca57f48a8a84787af817053917f37a0.r2.dev";

export function genericProductImageUrl(path: string | null | undefined): string | null {
  const key = path?.trim().replace(/^\/+/, "");
  if (!key) return null;
  return `${PUBLIC_IMAGES_BASE_URL}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function normaliseImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function barcodeProductImageUrl(product: { image_path?: string | null; image_url?: string | null } | null | undefined): string | null {
  return genericProductImageUrl(product?.image_path) ?? normaliseImageUrl(product?.image_url);
}
