import type { ThumbnailTextOptions } from "./types.js";

export function validateThumbnailText(options: ThumbnailTextOptions) {
  const { bottomText, accentRange } = options;
  if (bottomText !== undefined && (typeof bottomText !== "string" || bottomText.length > 160 || /[\r\n]/.test(bottomText)))
    throw new Error("Thumbnail text must be one line with at most 160 characters.");
  if (accentRange && (!Number.isInteger(accentRange.start) || !Number.isInteger(accentRange.end) ||
      accentRange.start < 0 || accentRange.end <= accentRange.start || accentRange.end > (bottomText?.length ?? 0)))
    throw new Error("Select a valid range in the thumbnail text.");
}
