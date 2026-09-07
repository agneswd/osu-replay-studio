// Display order is independent of replay bit flags and API array order.
const order = ["NF", "EZ", "TD", "HD", "HR", "SD", "PF", "DT", "NC", "HT", "DC", "FL", "RX", "AP", "SO", "AT", "FI", "MR", "CL", "V2", "DA", "AS", "CS"];
const ranks = new Map(order.map((mod, index) => [mod, index]));

// NC replaces DT and PF replaces SD. Unknown mods follow known mods alphabetically.
export function displayMods(value?: string): string[] {
  if (!value || value.toUpperCase() === "NONE") return [];
  const mods = new Set(value.toUpperCase().match(/.{1,2}/g) ?? []);
  mods.delete("NM");
  if (mods.has("NC")) mods.delete("DT");
  if (mods.has("PF")) mods.delete("SD");
  return [...mods].sort((a, b) => (ranks.get(a) ?? order.length) - (ranks.get(b) ?? order.length) || (a < b ? -1 : a > b ? 1 : 0));
}
