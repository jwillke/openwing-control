export type WingAppearance = {
    colorId: number;
    iconId: number;
    streamDeckColor: string;
};

const defaultColorId = 0;
const defaultIconId = 0;
const defaultStreamDeckColor = "#6b7280";

const streamDeckColorsByWingColorId = new Map<number, string>([
    [0, defaultStreamDeckColor],
    [1, "#ef4444"],
    [2, "#f97316"],
    [3, "#eab308"],
    [4, "#22c55e"],
    [5, "#14b8a6"],
    [6, "#06b6d4"],
    [7, "#3b82f6"],
    [8, "#6366f1"],
    [9, "#a855f7"],
    [10, "#ec4899"],
    [11, "#f43f5e"],
    [12, "#84cc16"],
    [13, "#10b981"],
    [14, "#0ea5e9"],
    [15, "#f59e0b"]
]);

export function getAppearance(colorId: number | undefined, iconId: number | undefined): WingAppearance {
    const resolvedColorId = colorId ?? defaultColorId;
    const resolvedIconId = iconId ?? defaultIconId;

    return {
        colorId: resolvedColorId,
        iconId: resolvedIconId,
        streamDeckColor: streamDeckColorsByWingColorId.get(resolvedColorId) ?? defaultStreamDeckColor
    };
}
