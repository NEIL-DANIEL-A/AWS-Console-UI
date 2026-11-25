export const SITE_URL =
  (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
    .VITE_SITE_URL || window.location.origin;
