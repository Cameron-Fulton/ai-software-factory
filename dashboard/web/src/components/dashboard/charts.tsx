"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipContent } from "@/components/application/charts/charts-base";
import { Empty } from "./cards";

const axis = { tickLine: false, axisLine: false, fontSize: 12, className: "fill-(--color-text-tertiary)" } as const;
const grid = <CartesianGrid vertical={false} className="stroke-(--color-border-secondary)" strokeDasharray="0" />;

type Row = Record<string, number | string | null>;

// Legend dots take each series' own color; the kit's legend reads a class instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SeriesLegend = ({ payload }: { payload?: any[] }) => (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 pb-2">
        {payload?.map((e) => (
            <li key={e.value} className="flex items-center gap-2 text-sm text-tertiary">
                <span className="block size-2.5 rounded-full" style={{ background: e.color }} />
                {e.value}
            </li>
        ))}
    </ul>
);

/** Stacked columns over time, one segment per series (models, categories). */
export const StackedColumns = ({
    rows,
    series,
    color,
    format,
    label,
    height = 280,
}: {
    rows: Row[];
    series: string[];
    color: (name: string) => string;
    format: (v: number) => string;
    label?: (key: string) => string;
    height?: number;
}) => {
    if (!rows.length || !series.length) return <Empty />;
    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="20%">
                {grid}
                <XAxis dataKey="label" {...axis} minTickGap={16} />
                <YAxis {...axis} width={56} tickFormatter={(v) => format(Number(v))} />
                <Tooltip
                    cursor={{ className: "fill-(--color-bg-secondary)" }}
                    content={<ChartTooltipContent />}
                    formatter={(v) => format(Number(v))}
                />
                <Legend verticalAlign="top" align="left" content={<SeriesLegend />} />
                {series.map((s, i) => (
                    <Bar
                        key={s}
                        dataKey={s}
                        name={label ? label(s) : s}
                        stackId="a"
                        fill={color(s)}
                        stroke="var(--color-bg-primary)"
                        strokeWidth={1}
                        radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                        maxBarSize={36}
                        isAnimationActive={false}
                    />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
};

/** Lines on one shared scale (never a second axis). */
export const Lines = ({
    rows,
    lines,
    format,
    domain,
    height = 260,
}: {
    rows: Row[];
    lines: { key: string; name: string; color: string }[];
    format: (v: number) => string;
    domain?: [number, number];
    height?: number;
}) => {
    if (!rows.length) return <Empty />;
    return (
        <ResponsiveContainer width="100%" height={height}>
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
                {grid}
                <XAxis dataKey="label" {...axis} minTickGap={16} />
                <YAxis {...axis} width={44} domain={domain} tickFormatter={(v) => format(Number(v))} />
                <Tooltip content={<ChartTooltipContent />} formatter={(v) => format(Number(v))} />
                {lines.length > 1 && <Legend verticalAlign="top" align="left" content={<SeriesLegend />} />}
                {lines.map((l) => (
                    <Line
                        key={l.key}
                        dataKey={l.key}
                        name={l.name}
                        stroke={l.color}
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 0, fill: l.color }}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-bg-primary)", fill: l.color }}
                        connectNulls
                        isAnimationActive={false}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
};

/** Ranked horizontal bars, largest first, each in its entity's color. */
export const RankedBars = ({
    rows,
    color,
    format,
    height,
}: {
    rows: { name: string; value: number; label?: string }[];
    color: (name: string) => string;
    format: (v: number) => string;
    height?: number;
}) => {
    if (!rows.length) return <Empty />;
    const max = Math.max(...rows.map((r) => r.value), 0) || 1;
    return (
        <ul className="flex flex-col gap-3" style={height ? { minHeight: height } : undefined}>
            {rows.map((r) => (
                <li key={r.name} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm" title={`${r.label ?? r.name}: ${format(r.value)}`}>
                    <span className="truncate text-secondary">{r.label ?? r.name}</span>
                    <span className="h-5 rounded-r bg-secondary">
                        <span className="block h-5 rounded-r" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color(r.name) }} />
                    </span>
                    <span className="text-right font-medium text-primary tabular-nums">{format(r.value)}</span>
                </li>
            ))}
        </ul>
    );
};
