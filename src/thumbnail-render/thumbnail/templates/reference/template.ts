import type { ThumbnailTemplate } from "../../types";
import { referenceLayout } from "./layout";
import { referenceTheme } from "./theme";
export const referenceTemplate: ThumbnailTemplate = {
    id: "reference",
    name: "CPOLesque",
    canvas: { width: 1280, height: 720 },
    theme: referenceTheme,
    background: {
        visible: true,
        source: undefined,
        fallbacks: [],
        blur: 6,
        brightness: 0.5,
        saturation: 0.6,
        scale: 1,
        objectFit: "cover",
        objectPosition: "center",
        overlays: [
            {
                visible: true,
                kind: "solid",
                color: "#141414",
                opacity: 0.45,
            },
            {
                visible: true,
                kind: "linear-gradient",
                gradient: "180deg, rgba(22, 10, 13, 0.05) 0%, rgba(22, 10, 13, 0.72) 100%",
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
            A: "#63E564",
            B: "#53B0D9",
            C: "#C77BD0",
            D: "#E04A4A",
        },
        bottomPrefix: "",
    },
    components: referenceLayout,
};
