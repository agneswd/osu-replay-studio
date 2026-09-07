import { overlayBounds, normalizeLayout } from "../core/layout.js";
import { frameAt } from "../core/timeline.js";

// Keep profile images and score pools in the overlay window. Frame messages carry only time and options.
Object.assign(window, { sampleReplayFrame: frameAt, studioLayout: { overlayBounds, normalizeLayout } });
