const MOD_ASSET_NAMES: Record<string, string> = {
  EZ: "easy",
  NF: "no-fail",
  HT: "half-time",
  HR: "hard-rock",
  SD: "sudden-death",
  PF: "perfect",
  DT: "double-time",
  NC: "nightcore",
  HD: "hidden",
  FL: "flashlight",
  RX: "relax",
  AP: "autopilot",
  SO: "spun-out",
  MR: "mirror",
  FI: "fade-in",
  TD: "touch-device",
  CL: "classic",
  V2: "score-v2",
  NM: "no-mod",
  DA: "difficulty-adjust",
  AS: "adaptive-speed",
  CS: "constant-speed",
};

const MOD_CATEGORY_COLORS: Record<string, { bg: string; fg: "dark" | "light" }> =
  {
    EZ: { bg: "#99FF4D", fg: "dark" },
    NF: { bg: "#99FF4D", fg: "dark" },
    HT: { bg: "#99FF4D", fg: "dark" },
    DC: { bg: "#99FF4D", fg: "dark" },
    HR: { bg: "#FF4D4D", fg: "light" },
    SD: { bg: "#FF4D4D", fg: "light" },
    PF: { bg: "#FF4D4D", fg: "light" },
    DT: { bg: "#FF4D4D", fg: "light" },
    NC: { bg: "#7A5CFF", fg: "light" },
    FL: { bg: "#FF4D4D", fg: "light" },
    HD: { bg: "#FFCC22", fg: "dark" },
    RX: { bg: "#4DC3FF", fg: "light" },
    AP: { bg: "#4DC3FF", fg: "light" },
    MR: { bg: "#8C5CFF", fg: "light" },
    V2: { bg: "#8C5CFF", fg: "light" },
    FI: { bg: "#FF4D9A", fg: "light" },
  };

export function ModBadgeList({ modStr }: { modStr?: string }) {
  if (!modStr || modStr === "NM" || modStr === "None") {
    return <span className="text-sm text-muted">None</span>;
  }
  const mods = modStr.match(/.{1,2}/g) || [];
  return (
    <div className="inline-flex items-center">
      {mods.map((mod, i) => {
        const u = mod.toUpperCase();
        const asset = MOD_ASSET_NAMES[u];
        const color = MOD_CATEGORY_COLORS[u] || { bg: "#8C5CFF", fg: "light" };
        return (
          <div
            key={`${mod}-${i}`}
            title={u}
            className="relative inline-flex size-5 items-center justify-center overflow-hidden rounded-sm"
            style={{
              backgroundColor: color.bg,
              marginLeft: i > 0 ? -4 : 0,
              zIndex: mods.length - i,
            }}
          >
            {asset ? (
              <img
                src={`./assets/mods/mod-${asset}.svg`}
                alt={u}
                className="size-full object-contain"
                style={{
                  filter: color.fg === "dark" ? "brightness(0.15)" : undefined,
                }}
              />
            ) : (
              <span className="text-[10px] font-extrabold text-white">{u}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function modAssetPath(acronym: string) {
  const name = MOD_ASSET_NAMES[acronym.toUpperCase()];
  return name ? `../../shared/assets/mods/mod-${name}.svg` : undefined;
}
export function modColor(acronym: string) {
  return MOD_CATEGORY_COLORS[acronym.toUpperCase()] ?? { bg: "#8C5CFF", fg: "light" as const };
}
