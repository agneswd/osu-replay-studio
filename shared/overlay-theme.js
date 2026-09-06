/* Overlay chrome uses one accent. Default is a light gray. */
(() => {
  const DEFAULT_ACCENT = "#d4d7de";

  function parseAccent(value) {
    if (typeof value !== "string") return null;
    let hex = value.trim();
    if (!hex.startsWith("#")) hex = `#${hex}`;
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
    return hex.toLowerCase();
  }

  function applyOverlayAccent(value, root = document.documentElement) {
    const hex = parseAccent(value) || DEFAULT_ACCENT;
    const n = Number.parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const channel = (c) => {
      const x = c / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    const luminance =
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    root.style.setProperty("--accent", hex);
    root.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
    root.style.setProperty("--on-accent", luminance > 0.45 ? "#161616" : "#f4f4f5");
  }

  window.parseOverlayAccent = parseAccent;
  window.applyOverlayAccent = applyOverlayAccent;
  window.DEFAULT_OVERLAY_ACCENT = DEFAULT_ACCENT;
  applyOverlayAccent(new URLSearchParams(location.search).get("accent"));
})();
