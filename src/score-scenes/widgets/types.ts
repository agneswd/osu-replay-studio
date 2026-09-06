export interface OverlayBadge {
    url: string;
    title: string;
}
export interface OverlayMonthlyCount {
    date: string;
    count: number;
}
export interface OverlayTopScore {
    rank: string;
    title: string;
    mods: string[];
    timeAgo: string;
    pp: string;
    cover?: string;
}

export interface OverlayScoreDetails {
    totalScore: string;
    combo: number;
    maxCombo: number;
    pp: string;
    accuracy: string;
    rank: string;
    count300: number;
    count100: number;
    count50: number;
    countMiss: number;
    playedAtAgo: string;
    mods: string[];
}

export interface OverlayData {
    player: {
        username: string;
        isSupporter: boolean;
        flag: string;
        countryCode: string;
        crank: string;
        grank: string;
        pp: string;
        hours: number;
        playcount: number;
        badgeCount: number;
        badges: OverlayBadge[];
        avatar: string;
        banner: string;
        monthlyPlaycounts: OverlayMonthlyCount[];
        peakMonth: string;
        peakCount: number;
    };
    map: {
        id?: number;
        retries?: { fail: number[]; exit: number[] };
        title: string;
        artist: string;
        cover: string;
        mapper: string;
        mapperAvatar: string;
        favs: string;
        plays: string;
        sr: string;
        bpm: string;
        ar: number;
        arMs: string;
        od: number;
        odMs: string;
        cs: number;
        hp: number;
        status?: string;
    };
    score?: OverlayScoreDetails;
    topScores?: OverlayTopScore[];
}
