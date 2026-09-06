// Load only osu!standard gameplay assets. Keep custom number prefixes from skin.ini.
export function gameplaySkinAssets(ini: string): (name: string) => boolean {
  const prefixes = ["default", "score", ...[...ini.matchAll(/^(?:HitCircle|Score|Combo)Prefix\s*:\s*(.+)$/gim)].map(match => match[1].trim().toLowerCase())];
  return name => {
    const file = name.toLowerCase();
    if (file === "skin.ini") return true;
    if (/\.(wav|ogg|mp3)$/.test(file)) return /^(?:(?:normal|soft|drum)-(?:hitnormal|hitclap|hitfinish|hitwhistle|slidertick|sliderslide|sliderwhistle)|combobreak|spinnerspin|spinnerbonus)\./.test(file);
    if (!file.endsWith(".png")) return false;
    const stem = file.replace(/(?:@2x)?\.png$/, "");
    return /^(?:cursor(?:middle|trail)?|approachcircle|reversearrow|followpoint(?:-\d+)?|hitcircle(?:overlay)?|hit(?:0|50|100|300)(?:[gk]|-\d+)?|slider(?:startcircle(?:overlay)?|endcircle(?:overlay)?|followcircle|scorepoint|b\d*)|spinner-.+)$/.test(stem)
      || prefixes.some(prefix => stem.startsWith(`${prefix}-`));
  };
}
