// The collector's data.json, and every number the dashboard derives from it.
// All aggregation happens here, in the browser, so filters re-slice the same records.

export interface Step {
    t: number | null;
    run: string;
    project: string;
    model: string;
    workflow: string;
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    turns: number;
    seconds: number;
    cost: number;
}

export interface Run {
    id: string;
    project: string;
    workflow: string;
    status: string;
    issue: number | null;
    start: number | null;
    end: number | null;
    cost: number;
    ready: boolean | null;
}

export type TaskStatus = "merged" | "in progress" | "needs a person" | "other";

export interface Task {
    project: string;
    issue: number;
    title: string;
    url: string | null;
    pr: string | null;
    status: TaskStatus;
    stage: string;
    blockedBecause: string | null;
    started: number | null;
    finished: number | null;
    runs: number;
    reviews: number;
    firstReviewReady: boolean | null;
    repairs: number;
    failures: number;
    cost: number;
}

export interface Failure {
    t: number | null;
    project: string | null;
    issue: number | null;
    workflow: string | null;
    kind: "run" | "step";
    category: string;
}

export interface Login {
    login: string;
    available: boolean;
    until: number | null;
    lastUsed: number | null;
}

export interface FactoryData {
    version: number;
    generated: number;
    projects: string[];
    weights: { first_try: number; cost: number; time: number; rework: number };
    prices: Record<string, number[]>;
    steps: Step[];
    runs: Run[];
    tasks: Task[];
    failures: Failure[];
    logins: Login[];
}

export interface Filters {
    days: number | null; // null = all time
    project: string | null; // null = every project
    model: string | null; // null = every model
}

export const DAY = 86400;

export const RANGES: { id: string; label: string; days: number | null }[] = [
    { id: "7", label: "7 days", days: 7 },
    { id: "14", label: "14 days", days: 14 },
    { id: "30", label: "30 days", days: 30 },
    { id: "90", label: "90 days", days: 90 },
    { id: "all", label: "All time", days: null },
];

export async function loadData(signal?: AbortSignal): Promise<FactoryData> {
    const res = await fetch(`./data.json?t=${Date.now()}`, { cache: "no-store", signal, credentials: "same-origin" });
    if (!res.ok) throw new Error(`data.json answered ${res.status}`);
    return (await res.json()) as FactoryData;
}

/** The window [from, to) the filters select, and the same-length window before it. */
export function windows(data: FactoryData, f: Filters) {
    const to = data.generated;
    if (f.days == null) {
        const first = Math.min(...data.steps.map((s) => s.t ?? to), to);
        return { from: first, to, prevFrom: null as number | null, prevTo: null as number | null };
    }
    const from = to - f.days * DAY;
    return { from, to, prevFrom: from - f.days * DAY, prevTo: from };
}

const inProject = (f: Filters, p: string | null) => f.project == null || p === f.project;

export function stepsIn(data: FactoryData, f: Filters, from: number, to: number) {
    return data.steps.filter((s) => s.t != null && s.t >= from && s.t < to && inProject(f, s.project) && (f.model == null || s.model === f.model));
}

export function mergedIn(data: FactoryData, f: Filters, from: number, to: number) {
    return data.tasks.filter((t) => t.status === "merged" && t.finished != null && t.finished >= from && t.finished < to && inProject(f, t.project));
}

export function failuresIn(data: FactoryData, f: Filters, from: number, to: number) {
    return data.failures.filter((x) => x.t != null && x.t >= from && x.t < to && inProject(f, x.project));
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);
export function median(xs: number[]) {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const hours = (t: Task) => (t.finished != null && t.started != null ? (t.finished - t.started) / 3600 : null);
export const rework = (t: Task) => t.repairs + t.failures + Math.max(t.reviews - 1, 0);
export const firstTry = (t: Task) => (t.firstReviewReady == null ? null : t.firstReviewReady && t.repairs === 0);

export interface Efficiency {
    tasks: number;
    score: number | null;
    firstTryRate: number | null;
    costEach: number | null;
    hoursEach: number | null;
    reworkEach: number | null;
    parts: { first_try: number | null; cost: number | null; time: number | null; rework: number | null };
}

/** Baselines are the all-time medians across every merged task, so scores stay comparable. */
export function baselines(data: FactoryData) {
    const merged = data.tasks.filter((t) => t.status === "merged");
    return {
        cost: median(merged.map((t) => t.cost)),
        hours: median(merged.map(hours).filter((h): h is number => h != null)),
    };
}

export function efficiency(data: FactoryData, tasks: Task[]): Efficiency {
    const base = baselines(data);
    const rated = tasks.map(firstTry).filter((x): x is boolean => x != null);
    const firstTryRate = rated.length ? rated.filter(Boolean).length / rated.length : null;
    const costEach = mean(tasks.map((t) => t.cost));
    const hoursEach = mean(tasks.map(hours).filter((h): h is number => h != null));
    const reworkEach = mean(tasks.map(rework));
    const parts = {
        first_try: firstTryRate,
        cost: base.cost && costEach ? Math.min(1, base.cost / costEach) : null,
        time: base.hours && hoursEach ? Math.min(1, base.hours / hoursEach) : null,
        rework: reworkEach == null ? null : 1 / (1 + reworkEach),
    };
    const have = (Object.keys(parts) as (keyof typeof parts)[]).filter((k) => parts[k] != null);
    const weight = sum(have.map((k) => data.weights[k]));
    const score = weight ? Math.round((100 * sum(have.map((k) => data.weights[k] * (parts[k] as number)))) / weight) : null;
    return { tasks: tasks.length, score: tasks.length ? score : null, firstTryRate, costEach, hoursEach, reworkEach, parts };
}

/** Day buckets (UTC) from `from` to `to`, oldest first. Weekly when the range is long. */
export function buckets(from: number, to: number) {
    const span = to - from;
    const size = span > 60 * DAY ? 7 * DAY : DAY;
    const start = Math.floor(from / size) * size;
    const out: { start: number; end: number; label: string }[] = [];
    for (let b = start; b < to; b += size) {
        const d = new Date(b * 1000);
        out.push({
            start: b,
            end: b + size,
            label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        });
    }
    return { size, rows: out };
}

/** Models in a stable order (by total cost, all time) so a model keeps its color under every filter. */
export function modelOrder(data: FactoryData) {
    const cost = new Map<string, number>();
    for (const s of data.steps) cost.set(s.model, (cost.get(s.model) ?? 0) + s.cost);
    return [...cost.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

export function categoryOrder(data: FactoryData) {
    const n = new Map<string, number>();
    for (const f of data.failures) n.set(f.category, (n.get(f.category) ?? 0) + 1);
    for (const t of data.tasks) if (t.blockedBecause) n.set(t.blockedBecause, (n.get(t.blockedBecause) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}
