import type { ThumbnailTemplate } from "../../types";
import { cuteLayout } from "./layout";
import { cuteTheme } from "./theme";
export const cuteTemplate: ThumbnailTemplate = {
    id: "cute",
    name: "Clean",
    canvas: { width: 1280, height: 720 },
    theme: cuteTheme,
    background: {
        visible: true,
        source: undefined,
        fallbacks: [],
        blur: 0.5,
        brightness: 0.95,
        saturation: 1.12,
        contrast: 1.05,
        scale: 1.02,
        objectFit: "cover",
        objectPosition: "center 30%",
        overlays: [
            {
                visible: true,
                kind: "linear-gradient",
                gradient: "90deg, rgba(15, 10, 24, 0.68) 0%, rgba(15, 10, 24, 0.34) 42%, rgba(15, 10, 24, 0.04) 72%",
                opacity: 0.9,
            },
            {
                visible: true,
                kind: "linear-gradient",
                gradient: "180deg, rgba(15, 10, 24, 0.02) 0%, rgba(15, 10, 24, 0.25) 50%, rgba(15, 10, 24, 0.72) 100%",
                opacity: 0.85,
                blendMode: "multiply",
            },
            {
                visible: true,
                kind: "solid",
                boxShadow: "inset 0 0 100px rgba(184, 184, 184, 0.25)",
                opacity: 1,
            },
        ],
    },
    dataOptions: {
        mapNameFormat: "artist-title",
        fcText: "FC",
        missText: "{count}x",
        sbText: "{count}xSB",
        maxLeaderboardPosition: 50,
        gradeColors: {
            A: "#55E6C1",
            B: "#FFD166",
            C: "#A29BFE",
            D: "#FF7675",
        },
        bottomPrefix: "",
    },
    bottomHighlightOverride: undefined,
    components: cuteLayout,
};
export default cuteTemplate;
