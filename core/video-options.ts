export const resolutions = [[854, 480], [1280, 720], [1920, 1080], [2560, 1440], [3840, 2160]] as const;
export const frameRates = [24, 30, 60, 120] as const;
export const defaultVideo = { width: 1920, height: 1080, fps: 60, backgroundDim: .72, cursorSize: 1 };
export function videoSettings(saved: { width?: number; height?: number; fps?: number; backgroundDim?: number; cursorSize?: number }) {
  const size = resolutions.find(([w, h]) => w === saved.width && h === saved.height) ?? [1920, 1080];
  return { width: size[0], height: size[1], fps: frameRates.find(fps => fps === saved.fps) ?? 60,
    backgroundDim: Number.isFinite(saved.backgroundDim) ? Math.max(0, Math.min(1, saved.backgroundDim!)) : .72,
    cursorSize: Number.isFinite(saved.cursorSize) ? Math.max(.5, Math.min(2, saved.cursorSize!)) : 1 };
}
