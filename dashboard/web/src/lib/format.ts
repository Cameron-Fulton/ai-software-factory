export const money = (v: number | null | undefined, digits = 2) =>
    v == null ? "–" : `$${v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const moneyShort = (v: number | null | undefined) => {
    if (v == null) return "–";
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
    return `$${v.toFixed(v >= 100 ? 0 : 2)}`;
};

export const pct = (v: number | null | undefined) => (v == null ? "–" : `${Math.round(v * 100)}%`);

export const count = (v: number | null | undefined) => (v == null ? "–" : v.toLocaleString("en-US"));

export const tokens = (v: number | null | undefined) => {
    if (v == null) return "–";
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
    return String(v);
};

export const hoursText = (v: number | null | undefined) => (v == null ? "–" : v < 1 ? `${Math.round(v * 60)} min` : `${v.toFixed(1)} h`);

export const when = (t: number | null | undefined) =>
    t == null ? "–" : new Date(t * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function ago(t: number | null | undefined, now = Date.now() / 1000) {
    if (t == null) return "–";
    const s = Math.max(0, now - t);
    if (s < 90) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} d ago`;
}

export function until(t: number | null | undefined, now = Date.now() / 1000) {
    if (t == null) return "–";
    const s = Math.max(0, t - now);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

/** Change against the previous window, as a signed fraction, or null when there is nothing to compare. */
export const change = (now: number | null, before: number | null) =>
    now == null || before == null || before === 0 ? null : (now - before) / Math.abs(before);

/** Short model names for axes and legends. */
export const modelName = (m: string) =>
    m
        .replace(/^claude-/, "")
        .replace(/-(\d+)-(\d+)$/, " $1.$2")
        .replace(/-(\d+)$/, " $1")
        .replace(/^./, (c) => c.toUpperCase());
