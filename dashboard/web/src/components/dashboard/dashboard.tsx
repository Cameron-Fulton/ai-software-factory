"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChartSquare02, CpuChip01, LayoutAlt01, RefreshCw01, Users01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { Select } from "@/components/base/select/select";
import type { FactoryData, Filters, Task } from "@/lib/factory-data";
import {
    DAY,
    RANGES,
    buckets,
    categoryOrder,
    efficiency,
    failuresIn,
    firstTry,
    loadData,
    mergedIn,
    modelOrder,
    stepsIn,
    sum,
    windows,
} from "@/lib/factory-data";
import { ago, change, count, hoursText, modelName, money, moneyShort, pct, tokens, until, when } from "@/lib/format";
import { cx } from "@/utils/cx";
import { ChartCard, Empty, MetricCard } from "./cards";
import { Lines, RankedBars, StackedColumns } from "./charts";
import { colorMap, seriesColor } from "./series";
import { StatusText, TasksTable } from "./tasks-table";

type View = "overview" | "tasks" | "models" | "failures" | "logins";

const NAV: { id: View; label: string; icon: typeof LayoutAlt01 }[] = [
    { id: "overview", label: "Overview", icon: LayoutAlt01 },
    { id: "tasks", label: "Tasks", icon: BarChartSquare02 },
    { id: "models", label: "Models", icon: CpuChip01 },
    { id: "failures", label: "Failures", icon: AlertTriangle },
    { id: "logins", label: "Logins", icon: Users01 },
];

const REFRESH_MS = 5 * 60 * 1000;

export const Dashboard = () => {
    const [data, setData] = useState<FactoryData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<View>("overview");
    const [filters, setFilters] = useState<Filters>({ days: 30, project: null, model: null });
    const [, tick] = useState(0);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            setData(await loadData());
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const a = setInterval(refresh, REFRESH_MS);
        const b = setInterval(() => tick((n) => n + 1), 30_000); // keeps "updated 3 min ago" and countdowns moving
        const fromHash = () => {
            const v = window.location.hash.slice(1) as View;
            if (NAV.some((n) => n.id === v)) setView(v);
        };
        fromHash();
        window.addEventListener("hashchange", fromHash);
        return () => {
            clearInterval(a);
            clearInterval(b);
            window.removeEventListener("hashchange", fromHash);
        };
    }, [refresh]);

    const go = (v: View) => {
        setView(v);
        window.history.replaceState(null, "", `#${v}`);
    };

    if (!data) {
        return (
            <div className="flex h-dvh items-center justify-center p-6 text-sm text-tertiary">
                {error ? `The dashboard could not load its data: ${error}` : "Loading the factory's records…"}
            </div>
        );
    }

    return (
        <div className="flex min-h-dvh bg-secondary_subtle lg:bg-primary">
            <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-secondary bg-primary px-4 py-6 lg:flex">
                <div className="px-2">
                    <p className="text-lg font-semibold text-primary">Factory</p>
                    <p className="text-xs text-tertiary">{data.projects.join(" · ")}</p>
                </div>
                <nav className="mt-8 flex flex-col gap-1" aria-label="Views">
                    {NAV.map((n) => (
                        <button
                            key={n.id}
                            onClick={() => go(n.id)}
                            className={cx(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-left text-md font-semibold transition-colors",
                                view === n.id ? "bg-active text-secondary_hover" : "text-secondary hover:bg-primary_hover",
                            )}
                        >
                            <n.icon className="size-5 text-fg-quaternary" />
                            {n.label}
                        </button>
                    ))}
                </nav>
                <div className="mt-auto px-2 text-xs text-tertiary">
                    Updated {ago(data.generated)}
                    <br />
                    Refreshes every 15 minutes
                </div>
            </aside>

            <main className="min-w-0 flex-1 overflow-x-hidden">
                <header className="z-10 border-b border-secondary bg-primary/95 backdrop-blur lg:sticky lg:top-0">
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-8">
                        <nav className="flex w-full gap-1 overflow-x-auto lg:hidden" aria-label="Views">
                            {NAV.map((n) => (
                                <button
                                    key={n.id}
                                    onClick={() => go(n.id)}
                                    className={cx(
                                        "shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold",
                                        view === n.id ? "bg-active text-secondary_hover" : "text-tertiary",
                                    )}
                                >
                                    {n.label}
                                </button>
                            ))}
                        </nav>
                        <h1 className="mr-auto text-display-xs font-semibold text-primary">{NAV.find((n) => n.id === view)?.label}</h1>
                        <div className="w-full overflow-x-auto sm:w-auto">
                        <ButtonGroup
                            size="sm"
                            selectedKeys={[RANGES.find((r) => r.days === filters.days)?.id ?? "30"]}
                            onSelectionChange={(keys) => {
                                const id = [...keys][0];
                                if (id) setFilters((f) => ({ ...f, days: RANGES.find((r) => r.id === id)?.days ?? null }));
                            }}
                            aria-label="Time range"
                        >
                            {RANGES.map((r) => (
                                <ButtonGroupItem key={r.id} id={r.id}>
                                    {r.label}
                                </ButtonGroupItem>
                            ))}
                        </ButtonGroup>
                        </div>
                        <Select
                            aria-label="Project"
                            size="sm"
                            className="w-[calc(50%-6px)] sm:w-40"
                            selectedKey={filters.project ?? "all"}
                            onSelectionChange={(k) => setFilters((f) => ({ ...f, project: k === "all" ? null : String(k) }))}
                            items={[{ id: "all", label: "Every project" }, ...data.projects.map((p) => ({ id: p, label: p }))]}
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                        <Select
                            aria-label="Model"
                            size="sm"
                            className="w-[calc(50%-6px)] sm:w-44"
                            selectedKey={filters.model ?? "all"}
                            onSelectionChange={(k) => setFilters((f) => ({ ...f, model: k === "all" ? null : String(k) }))}
                            items={[{ id: "all", label: "Every model" }, ...modelOrder(data).map((m) => ({ id: m, label: modelName(m) }))]}
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                        <Button size="sm" color="secondary" iconLeading={RefreshCw01} onClick={refresh} isLoading={loading}>
                            Refresh
                        </Button>
                    </div>
                    {error && <p className="px-4 pb-2 text-sm text-error-primary lg:px-8">Last refresh failed ({error}); showing the data from {when(data.generated)}.</p>}
                </header>

                <div className="flex flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
                    {view === "overview" && <Overview data={data} filters={filters} go={go} />}
                    {view === "tasks" && <TasksView data={data} filters={filters} />}
                    {view === "models" && <ModelsView data={data} filters={filters} />}
                    {view === "failures" && <FailuresView data={data} filters={filters} />}
                    {view === "logins" && <LoginsView data={data} />}
                </div>
            </main>
        </div>
    );
};

/* ---------- shared slices ---------- */

function useSlices(data: FactoryData, filters: Filters) {
    return useMemo(() => {
        const w = windows(data, filters);
        const steps = stepsIn(data, filters, w.from, w.to);
        const merged = mergedIn(data, filters, w.from, w.to);
        const prevSteps = w.prevFrom != null ? stepsIn(data, filters, w.prevFrom, w.prevTo!) : null;
        const prevMerged = w.prevFrom != null ? mergedIn(data, filters, w.prevFrom, w.prevTo!) : null;
        const b = buckets(w.from, w.to);
        return { w, steps, merged, prevSteps, prevMerged, b };
    }, [data, filters]);
}

const projectTasks = (data: FactoryData, filters: Filters) => data.tasks.filter((t) => filters.project == null || t.project === filters.project);

/* ---------- overview ---------- */

const Overview = ({ data, filters, go }: { data: FactoryData; filters: Filters; go: (v: View) => void }) => {
    const { steps, merged, prevSteps, prevMerged, b, w } = useSlices(data, filters);
    const models = modelOrder(data);
    const modelColor = colorMap(models);
    const eff = efficiency(data, merged);
    const prevEff = prevMerged ? efficiency(data, prevMerged) : null;
    const cost = sum(steps.map((s) => s.cost));
    const prevCost = prevSteps ? sum(prevSteps.map((s) => s.cost)) : null;
    const all = projectTasks(data, filters);
    const running = all.filter((t) => t.status === "in progress");
    const waiting = all.filter((t) => t.status === "needs a person");

    const costRows = b.rows.map((r) => {
        const row: Record<string, number | string> = { label: r.label };
        for (const m of models) row[m] = 0;
        for (const s of steps) if (s.t! >= r.start && s.t! < r.end) row[s.model] = (row[s.model] as number) + s.cost;
        return row;
    });
    const usedModels = models.filter((m) => steps.some((s) => s.model === m));

    const projects = filters.project ? [filters.project] : data.projects;
    const projectColor = colorMap(data.projects);
    const mergedRows = b.rows.map((r) => {
        const row: Record<string, number | string> = { label: r.label };
        for (const p of projects) row[p] = merged.filter((t) => t.project === p && t.finished! >= r.start && t.finished! < r.end).length;
        return row;
    });

    // weekly efficiency trend over the selected window
    const weeks = weekRows(data, filters, w.from, w.to);

    const stops = categoryCounts(data, filters, w.from, w.to);
    const catColor = colorMap(categoryOrder(data));
    const avail = data.logins.filter((l) => l.available).length;

    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Tasks merged" value={count(merged.length)} delta={prevMerged ? change(merged.length, prevMerged.length) : null} />
                <MetricCard
                    title="Estimated API cost"
                    value={moneyShort(cost)}
                    delta={change(cost, prevCost)}
                    goodWhen="down"
                    footnote="What these tokens would cost at API prices"
                />
                <MetricCard
                    title="Cost per merged task"
                    value={money(eff.costEach)}
                    delta={prevEff ? change(eff.costEach, prevEff.costEach) : null}
                    goodWhen="down"
                />
                <MetricCard
                    title="Efficiency score"
                    value={eff.score == null ? "–" : `${eff.score}`}
                    delta={prevEff ? change(eff.score, prevEff.score) : null}
                    footnote={`First-try review ${pct(eff.firstTryRate)} · ${hoursText(eff.hoursEach)} per task`}
                />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <ChartCard title="Estimated API cost by model" description="Per day, or per week over long ranges" className="xl:col-span-2">
                    <StackedColumns rows={costRows} series={usedModels} color={modelColor} format={moneyShort} label={modelName} height={420} />
                </ChartCard>
                <ChartCard
                    title="Right now"
                    description={`${running.length} running · ${waiting.length} waiting for a person · ${avail} of ${data.logins.length} logins with usage left`}
                >
                    <ul className="flex flex-col divide-y divide-secondary">
                        {running.length === 0 && <li className="py-2 text-sm text-tertiary">Nothing running.</li>}
                        {running.map((t) => (
                            <TaskLine key={`${t.project}-${t.issue}`} t={t} />
                        ))}
                        {waiting.slice(0, 6).map((t) => (
                            <TaskLine key={`${t.project}-${t.issue}`} t={t} />
                        ))}
                    </ul>
                    {waiting.length > 6 && (
                        <Button size="sm" color="link-color" className="mt-3" onClick={() => go("failures")}>
                            See all {waiting.length} waiting
                        </Button>
                    )}
                </ChartCard>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <ChartCard title="Tasks merged" description="By project">
                    <StackedColumns rows={mergedRows} series={projects} color={projectColor} format={(v) => count(Math.round(v))} />
                </ChartCard>
                <ChartCard title="Quality by week" description="Efficiency score and the share of tasks that passed review on the first try, both out of 100">
                    <Lines
                        rows={weeks}
                        domain={[0, 100]}
                        format={(v) => `${Math.round(v)}`}
                        lines={[
                            { key: "score", name: "Efficiency score", color: seriesColor(0) },
                            { key: "firstTry", name: "First-try review %", color: seriesColor(1) },
                        ]}
                    />
                </ChartCard>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <ChartCard title="Why work stopped" description="Failed runs and tasks waiting for a person, by cause">
                    <RankedBars rows={stops} color={catColor} format={(v) => count(v)} />
                </ChartCard>
                <ChartCard title="Where the money goes" description="Estimated cost by stage of the work">
                    <RankedBars rows={stageCost(steps)} color={colorMap(["ship", "review", "deliver", "merge-queue"])} format={moneyShort} />
                </ChartCard>
            </div>
        </>
    );
};

const TaskLine = ({ t }: { t: Task }) => (
    <li className="flex items-start justify-between gap-3 py-2.5">
        <div className="min-w-0">
            <a href={t.url ?? undefined} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-primary hover:underline">
                #{t.issue} {t.title}
            </a>
            <p className="truncate text-xs text-tertiary">
                {t.project}
                {t.blockedBecause ? ` · ${t.blockedBecause}` : ` · ${t.stage}`}
            </p>
        </div>
        <span className="shrink-0 text-xs">
            <StatusText status={t.status} />
        </span>
    </li>
);

function weekRows(data: FactoryData, filters: Filters, from: number, to: number) {
    const size = 7 * DAY;
    const out: Record<string, number | string | null>[] = [];
    for (let start = Math.floor(from / size) * size; start < to; start += size) {
        const tasks = mergedIn(data, filters, start, start + size);
        const e = efficiency(data, tasks);
        out.push({
            label: new Date(start * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
            score: e.score,
            firstTry: e.firstTryRate == null ? null : Math.round(e.firstTryRate * 100),
        });
    }
    return out;
}

function categoryCounts(data: FactoryData, filters: Filters, from: number, to: number) {
    const n = new Map<string, number>();
    for (const f of failuresIn(data, filters, from, to)) if (f.kind === "run") n.set(f.category, (n.get(f.category) ?? 0) + 1);
    for (const t of projectTasks(data, filters)) if (t.blockedBecause) n.set(t.blockedBecause, (n.get(t.blockedBecause) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
}

function stageCost(steps: { workflow: string; cost: number }[]) {
    const n = new Map<string, number>();
    for (const s of steps) n.set(s.workflow, (n.get(s.workflow) ?? 0) + s.cost);
    const label: Record<string, string> = { ship: "Building", review: "Reviewing", deliver: "Repairing", "merge-queue": "Merging" };
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, label: label[name] ?? name }));
}

/* ---------- tasks ---------- */

const TasksView = ({ data, filters }: { data: FactoryData; filters: Filters }) => {
    const { merged, w } = useSlices(data, filters);
    const all = projectTasks(data, filters);
    const inWindow = all.filter((t) => t.status !== "merged" || (t.finished != null && t.finished >= w.from));
    const eff = efficiency(data, merged);
    const rated = merged.map(firstTry).filter((x) => x != null);
    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Merged in this period" value={count(merged.length)} />
                <MetricCard title="Passed review first try" value={pct(eff.firstTryRate)} footnote={`${rated.filter(Boolean).length} of ${rated.length} reviewed`} />
                <MetricCard title="Time per merged task" value={hoursText(eff.hoursEach)} />
                <MetricCard title="Rework per task" value={eff.reworkEach == null ? "–" : eff.reworkEach.toFixed(1)} footnote="Repairs, failed attempts and extra reviews" />
            </div>
            <TasksTable tasks={inWindow} description="Open tasks, and tasks merged in the selected period" />
        </>
    );
};

/* ---------- models ---------- */

const ModelsView = ({ data, filters }: { data: FactoryData; filters: Filters }) => {
    const { steps, b } = useSlices(data, filters);
    const models = modelOrder(data);
    const color = colorMap(models);
    const rows = models
        .map((m) => {
            const s = steps.filter((x) => x.model === m);
            const runs = new Set(s.map((x) => x.run));
            const failedRuns = data.runs.filter((r) => r.status === "failed" && runs.has(r.id)).length;
            const input = sum(s.map((x) => x.input));
            return {
                model: m,
                steps: s.length,
                runs: runs.size,
                failedRuns,
                cost: sum(s.map((x) => x.cost)),
                input,
                output: sum(s.map((x) => x.output)),
                cacheShare: input ? sum(s.map((x) => x.cacheRead)) / input : null,
                turns: s.length ? sum(s.map((x) => x.turns)) / s.length : null,
                minutes: s.length ? sum(s.map((x) => x.seconds)) / s.length / 60 : null,
                costPerStep: s.length ? sum(s.map((x) => x.cost)) / s.length : null,
            };
        })
        .filter((r) => r.steps > 0);

    const tokenRows = b.rows.map((r) => {
        const row: Record<string, number | string> = { label: r.label };
        for (const m of models) row[m] = 0;
        for (const s of steps) if (s.t! >= r.start && s.t! < r.end) row[s.model] = (row[s.model] as number) + s.output;
        return row;
    });

    return (
        <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <ChartCard title="Share of estimated cost" description="By model, in the selected period">
                    <RankedBars rows={rows.map((r) => ({ name: r.model, value: r.cost, label: modelName(r.model) }))} color={color} format={moneyShort} />
                </ChartCard>
                <ChartCard title="Cost per step" description="Average estimated cost of one step on each model">
                    <RankedBars
                        rows={rows.map((r) => ({ name: r.model, value: r.costPerStep ?? 0, label: modelName(r.model) }))}
                        color={color}
                        format={(v) => money(v)}
                    />
                </ChartCard>
            </div>
            <ChartCard title="Output tokens by model" description="Tokens the models wrote, per day or week">
                <StackedColumns rows={tokenRows} series={rows.map((r) => r.model)} color={color} format={tokens} label={modelName} />
            </ChartCard>
            <ChartCard title="Model details" description="Steps are single model calls inside a run; a run failed when the engine marked it failed">
                {rows.length === 0 ? (
                    <Empty />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm tabular-nums">
                            <thead>
                                <tr className="border-b border-secondary text-left text-xs font-semibold text-quaternary">
                                    {["Model", "Steps", "Runs", "Runs failed", "Turns per step", "Minutes per step", "Input tokens", "Output tokens", "From cache", "Estimated cost"].map(
                                        (h, i) => (
                                            <th key={h} className={cx("px-3 py-2 whitespace-nowrap", i > 0 && "text-right")}>
                                                {h}
                                            </th>
                                        ),
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.model} className="border-b border-secondary last:border-0">
                                        <td className="px-3 py-3 font-medium whitespace-nowrap text-primary">
                                            <span className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: color(r.model) }} />
                                            {modelName(r.model)}
                                        </td>
                                        <td className="px-3 py-3 text-right">{count(r.steps)}</td>
                                        <td className="px-3 py-3 text-right">{count(r.runs)}</td>
                                        <td className="px-3 py-3 text-right">{r.runs ? pct(r.failedRuns / r.runs) : "–"}</td>
                                        <td className="px-3 py-3 text-right">{r.turns?.toFixed(1)}</td>
                                        <td className="px-3 py-3 text-right">{r.minutes?.toFixed(1)}</td>
                                        <td className="px-3 py-3 text-right">{tokens(r.input)}</td>
                                        <td className="px-3 py-3 text-right">{tokens(r.output)}</td>
                                        <td className="px-3 py-3 text-right">{pct(r.cacheShare)}</td>
                                        <td className="px-3 py-3 text-right font-medium text-primary">{money(r.cost)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </ChartCard>
        </>
    );
};

/* ---------- failures ---------- */

const FailuresView = ({ data, filters }: { data: FactoryData; filters: Filters }) => {
    const { b, w } = useSlices(data, filters);
    const cats = categoryOrder(data);
    const color = colorMap(cats);
    const failures = failuresIn(data, filters, w.from, w.to).filter((f) => f.kind === "run");
    const rows = b.rows.map((r) => {
        const row: Record<string, number | string> = { label: r.label };
        for (const c of cats) row[c] = 0;
        for (const f of failures) if (f.t! >= r.start && f.t! < r.end) row[f.category] = (row[f.category] as number) + 1;
        return row;
    });
    const used = cats.filter((c) => failures.some((f) => f.category === c));
    const waiting = projectTasks(data, filters).filter((t) => t.status === "needs a person");
    const prevFailures = w.prevFrom != null ? failuresIn(data, filters, w.prevFrom, w.prevTo!).filter((f) => f.kind === "run").length : null;

    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MetricCard title="Failed runs" value={count(failures.length)} delta={change(failures.length, prevFailures)} goodWhen="down" />
                <MetricCard title="Tasks waiting for a person" value={count(waiting.length)} />
                <MetricCard title="Most common cause" value={<span className="text-xl">{used[0] ?? "–"}</span>} />
            </div>
            <ChartCard title="Failed runs by cause" description="Per day, or per week over long ranges">
                <StackedColumns rows={rows} series={used} color={color} format={(v) => count(Math.round(v))} />
            </ChartCard>
            <TasksTable tasks={waiting} title="Waiting for a person" description="Each shows why the factory stopped" />
        </>
    );
};

/* ---------- logins ---------- */

const LoginsView = ({ data }: { data: FactoryData }) => {
    const out = data.logins.filter((l) => !l.available).sort((a, b) => (a.until ?? 0) - (b.until ?? 0));
    const next = out[0]?.until;
    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MetricCard title="Logins with usage left" value={`${data.logins.filter((l) => l.available).length} of ${data.logins.length}`} />
                <MetricCard title="Next reset" value={next ? until(next) : "–"} footnote={next ? when(next) : "Every login has usage left"} />
                <MetricCard
                    title="Factory can work"
                    value={data.logins.some((l) => l.available) ? "Yes" : "No"}
                    footnote="When every login is out, the factory waits for the first reset"
                />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.logins.map((l) => (
                    <div key={l.login} className="flex flex-col gap-2 rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset">
                        <div className="flex items-center justify-between">
                            <h3 className="text-md font-semibold text-primary">{l.login}</h3>
                            <span className={cx("inline-flex items-center gap-1.5 text-sm font-medium", l.available ? "text-success-primary" : "text-warning-primary")}>
                                <span className="size-2 rounded-full bg-current" />
                                {l.available ? "Usage left" : "Out of usage"}
                            </span>
                        </div>
                        <p className="text-sm text-tertiary">{l.available ? "Available now" : `Resets in ${until(l.until)} (${when(l.until)})`}</p>
                        <p className="text-xs text-tertiary">Last used {ago(l.lastUsed)}</p>
                    </div>
                ))}
            </div>
        </>
    );
};
