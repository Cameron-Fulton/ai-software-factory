"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/base/select/select";
import type { Estimate, FactoryData, Filters, GroupStats, Role, Step } from "@/lib/factory-data";
import { MIN_TASKS, ROLES, cacheShare, clearWinner, groupStats, mergedIn, stepsIn, sum, taskFacts, windows } from "@/lib/factory-data";
import { count, hoursText, modelName, money, pct } from "@/lib/format";
import { Empty } from "./cards";
import { type Column, DataTable } from "./data-table";

const range = (e: Estimate, f: (v: number) => string) =>
    e.value == null ? "–" : e.lo == null || e.hi == null ? f(e.value) : `${f(e.value)} (${f(e.lo)} to ${f(e.hi)})`;

const comboName = (key: string) => {
    const [builder, effort, reviewer] = key.split("|");
    return `${modelName(builder)}${effort ? ` ${effort}` : ""} builds, ${modelName(reviewer)} reviews`;
};

const roleName: Record<Role, string> = {
    builder: "Builder",
    reviewer: "Reviewer",
    verifier: "Verifier",
    merger: "Merger",
    planner: "Planner",
    triage: "Triage",
    other: "Other",
};

const MINIMUMS = [
    { id: "1", label: "Any number of tasks" },
    { id: String(MIN_TASKS), label: `${MIN_TASKS} or more tasks` },
    { id: "10", label: "10 or more tasks" },
];

export const CompareView = ({ data, filters }: { data: FactoryData; filters: Filters }) => {
    const [minimum, setMinimum] = useState("1");
    const { groups, roleRows } = useMemo(() => {
        const w = windows(data, filters);
        const facts = taskFacts(data, mergedIn(data, filters, w.from, w.to)).filter((f) => f.combination);
        const byCombo = new Map<string, typeof facts>();
        for (const f of facts) byCombo.set(f.combination!, [...(byCombo.get(f.combination!) ?? []), f]);
        const groups = [...byCombo.entries()].map(([k, fs]) => groupStats(k, fs));

        const byRole = new Map<string, Step[]>();
        for (const s of stepsIn(data, filters, w.from, w.to)) {
            if (!s.role) continue;
            const k = `${s.role}|${s.model}`;
            byRole.set(k, [...(byRole.get(k) ?? []), s]);
        }
        const roleRows = [...byRole.entries()].map(([k, ss]) => {
            const [role, model] = k.split("|") as [Role, string];
            return {
                key: k,
                role,
                model,
                steps: ss.length,
                cost: sum(ss.map((s) => s.cost)),
                repairCost: sum(ss.filter((s) => s.repair).map((s) => s.cost)),
                minutes: sum(ss.map((s) => s.seconds)) / ss.length / 60,
                cacheShare: cacheShare(ss),
            };
        });
        return { groups, roleRows };
    }, [data, filters]);

    if (!data.steps.some((s) => s.role)) return <Empty />;

    const cheapest = clearWinner(groups, (g) => g.cost);
    const fastest = clearWinner(groups, (g) => g.hours);
    const verdict =
        cheapest || fastest
            ? [
                  cheapest && `${comboName(cheapest.key)} costs the least per completed task.`,
                  fastest && `${comboName(fastest.key)} finishes tasks fastest.`,
              ]
                  .filter(Boolean)
                  .join(" ")
            : `No combination is clearly cheaper or faster yet: the ranges overlap, or a group has fewer than ${MIN_TASKS} merged tasks.`;

    const comboColumns: Column<GroupStats>[] = [
        { id: "combination", label: "Combination", value: (g) => comboName(g.key), render: (g) => <span className="font-medium text-primary">{comboName(g.key)}</span> },
        { id: "tasks", label: "Merged tasks", value: (g) => g.tasks, render: (g) => count(g.tasks) },
        { id: "firstTry", label: "First-try review", value: (g) => g.firstTry.value, render: (g) => range(g.firstTry, pct) },
        { id: "redo", label: "Redos per task", value: (g) => g.redo.value, render: (g) => range(g.redo, (v) => v.toFixed(1)) },
        { id: "cost", label: "Cost per completed task", value: (g) => g.cost.value, render: (g) => range(g.cost, (v) => money(v)) },
        { id: "costOfFailure", label: "Cost of failure per task", value: (g) => g.costOfFailure.value, render: (g) => range(g.costOfFailure, (v) => money(v)) },
        { id: "hours", label: "Hours to merge", value: (g) => g.hours.value, render: (g) => range(g.hours, hoursText) },
        { id: "workHours", label: "Working hours", value: (g) => g.workHours.value, render: (g) => range(g.workHours, hoursText) },
        { id: "cacheShare", label: "Input from cache", value: (g) => g.cacheShare, render: (g) => pct(g.cacheShare) },
    ];

    type RoleRow = (typeof roleRows)[number];
    const roleColumns: Column<RoleRow>[] = [
        { id: "role", label: "Role", value: (r) => ROLES.indexOf(r.role), render: (r) => <span className="font-medium text-primary">{roleName[r.role]}</span> },
        { id: "model", label: "Model", value: (r) => modelName(r.model) },
        { id: "steps", label: "Steps", value: (r) => r.steps, render: (r) => count(r.steps) },
        { id: "cost", label: "Estimated cost", value: (r) => r.cost, render: (r) => money(r.cost) },
        { id: "repairCost", label: "Spent on repairs", value: (r) => r.repairCost, render: (r) => money(r.repairCost) },
        { id: "minutes", label: "Minutes per step", value: (r) => r.minutes, render: (r) => r.minutes.toFixed(1) },
        { id: "cacheShare", label: "Input from cache", value: (r) => r.cacheShare, render: (r) => pct(r.cacheShare) },
    ];

    return (
        <>
            <p className="max-w-3xl text-md text-secondary">{verdict}</p>
            <DataTable
                title="Combinations"
                rows={groups.filter((g) => g.tasks >= Number(minimum))}
                columns={comboColumns}
                rowKey={(g) => g.key}
                empty="No merged tasks in this period."
                controls={
                    <Select aria-label="Minimum tasks" size="sm" className="sm:w-52" selectedKey={minimum} onSelectionChange={(k) => setMinimum(String(k))} items={MINIMUMS}>
                        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                    </Select>
                }
            />
            <DataTable title="Roles and models" rows={roleRows} columns={roleColumns} rowKey={(r) => r.key} empty="No steps in this period." />
        </>
    );
};
