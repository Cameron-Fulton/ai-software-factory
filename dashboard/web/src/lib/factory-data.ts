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
    // version 3; absent in older data files
    step?: string;
    role?: Role;
    repair?: boolean;
    started?: number | null;
    tier?: string | null;
    effort?: string | null;
    attempt?: number | null;
    failureKind?: string | null;
}

export type Role = "builder" | "reviewer" | "verifier" | "merger" | "planner" | "triage" | "other";
export const ROLES: Role[] = ["builder", "reviewer", "verifier", "merger", "planner", "triage", "other"];

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

export type TaskStatus = "merged" | "in progress" | "needs a person" | "waiting" | "closed" | "other";

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

/* ---------- comparisons (data version 3) ---------- */

/** A value with its 95% confidence range; lo/hi are null when the sample is too small for one. */
export interface Estimate {
    value: number | null;
    lo: number | null;
    hi: number | null;
    n: number;
}

/** Wilson score interval for a share of yes answers. */
export function rate(yes: number, n: number): Estimate {
    if (!n) return { value: null, lo: null, hi: null, n };
    const z = 1.96;
    const p = yes / n;
    const d = 1 + (z * z) / n;
    const c = (p + (z * z) / (2 * n)) / d;
    const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
    return { value: p, lo: Math.max(0, c - h), hi: Math.min(1, c + h), n };
}

// two-sided 95% t values by degrees of freedom; 1.96 past 30
const T95 = [12.71, 4.3, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23, 2.2, 2.18, 2.16, 2.14, 2.13, 2.12, 2.11, 2.1, 2.09, 2.09, 2.08, 2.07, 2.07, 2.06, 2.06, 2.06, 2.05, 2.05, 2.05, 2.04];

/** Mean with a t-interval. Costs and hours are skewed, so treat the range as a rough guide. */
export function average(xs: number[]): Estimate {
    const n = xs.length;
    const m = mean(xs);
    if (n < 2 || m == null) return { value: m, lo: null, hi: null, n };
    const sd = Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (n - 1));
    const h = (T95[n - 2] ?? 1.96) * (sd / Math.sqrt(n));
    return { value: m, lo: Math.max(0, m - h), hi: m + h, n };
}

/** Ranges that touch cannot be told apart; a missing range counts as overlapping everything. */
export const overlaps = (a: Estimate, b: Estimate) => a.lo == null || a.hi == null || b.lo == null || b.hi == null || (a.lo <= b.hi && b.lo <= a.hi);

const top = <T,>(xs: T[]): T | null => {
    const n = new Map<T, number>();
    for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

export interface TaskFacts {
    task: Task;
    builder: string | null;
    effort: string | null;
    reviewer: string | null;
    combination: string | null; // builder|effort|reviewer
    costOfFailure: number;
    workHours: number;
    input: number;
    cacheRead: number;
}

/** Per task: which models built and reviewed it, and what its failures cost. Needs version 3 steps. */
export function taskFacts(data: FactoryData, tasks: Task[]): TaskFacts[] {
    const runs = new Map(data.runs.map((r) => [r.id, r]));
    const byTask = new Map<string, { s: Step; r: Run }[]>();
    for (const s of data.steps) {
        const r = runs.get(s.run);
        if (!r?.issue || !s.role) continue;
        const k = `${r.project}#${r.issue}`;
        if (!byTask.has(k)) byTask.set(k, []);
        byTask.get(k)!.push({ s, r });
    }
    return tasks.map((task) => {
        const xs = byTask.get(`${task.project}#${task.issue}`) ?? [];
        const built = xs.filter(({ s }) => s.role === "builder" && !s.repair).map(({ s }) => s);
        const reviews = xs.filter(({ s, r }) => s.role === "reviewer" && r.workflow === "review").map(({ s }) => s);
        const builder = top(built.map((s) => s.model));
        const effort = top(built.map((s) => s.effort).filter((e): e is string => !!e));
        const reviewer = top(reviews.map((s) => s.model));
        // review runs after the first one are redone reviews
        const reviewRuns = [...new Set(xs.filter(({ r }) => r.workflow === "review").map(({ r }) => r))].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
        const extraReviews = new Set(reviewRuns.slice(1).map((r) => r.id));
        const failed = xs.filter(({ s, r }) => s.repair || r.status === "failed" || extraReviews.has(r.id));
        return {
            task,
            builder,
            effort,
            reviewer,
            combination: builder && reviewer ? `${builder}|${effort ?? ""}|${reviewer}` : null,
            costOfFailure: sum(failed.map(({ s }) => s.cost)),
            workHours: sum(xs.map(({ s }) => s.seconds)) / 3600,
            input: sum(xs.map(({ s }) => s.input)),
            cacheRead: sum(xs.map(({ s }) => s.cacheRead)),
        };
    });
}

export interface GroupStats {
    key: string;
    tasks: number;
    firstTry: Estimate;
    redo: Estimate;
    cost: Estimate;
    costOfFailure: Estimate;
    hours: Estimate;
    workHours: Estimate;
    cacheShare: number | null;
}

export function groupStats(key: string, facts: TaskFacts[]): GroupStats {
    const rated = facts.map((f) => firstTry(f.task)).filter((x): x is boolean => x != null);
    const input = sum(facts.map((f) => f.input));
    return {
        key,
        tasks: facts.length,
        firstTry: rate(rated.filter(Boolean).length, rated.length),
        redo: average(facts.map((f) => rework(f.task))),
        cost: average(facts.map((f) => f.task.cost)),
        costOfFailure: average(facts.map((f) => f.costOfFailure)),
        hours: average(facts.map((f) => hours(f.task)).filter((h): h is number => h != null)),
        workHours: average(facts.map((f) => f.workHours)),
        cacheShare: input ? sum(facts.map((f) => f.cacheRead)) / input : null,
    };
}

export const MIN_TASKS = 5;

/** The group that is best on `pick` with a range clear of every other group's; null when none is. */
export function clearWinner(groups: GroupStats[], pick: (g: GroupStats) => Estimate, lowerIsBetter = true): GroupStats | null {
    const ok = groups.filter((g) => g.tasks >= MIN_TASKS && pick(g).value != null);
    if (ok.length < 2) return null;
    const best = [...ok].sort((a, b) => (pick(a).value! - pick(b).value!) * (lowerIsBetter ? 1 : -1))[0];
    return ok.every((g) => g === best || !overlaps(pick(best), pick(g))) ? best : null;
}

/** Cache read tokens as a share of all input tokens. */
export const cacheShare = (steps: Step[]) => {
    const input = sum(steps.map((s) => s.input));
    return input ? sum(steps.map((s) => s.cacheRead)) / input : null;
};
