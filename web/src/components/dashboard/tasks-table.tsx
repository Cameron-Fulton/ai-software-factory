"use client";

import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";
import { SearchLg } from "@untitledui/icons";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import type { Task } from "@/lib/factory-data";
import { firstTry, hours } from "@/lib/factory-data";
import { hoursText, money, when } from "@/lib/format";
import { cx } from "@/utils/cx";

const PAGE = 15;

const statusTone: Record<string, string> = {
    merged: "text-success-primary",
    "in progress": "text-brand-secondary",
    "needs a person": "text-warning-primary",
    waiting: "text-tertiary",
    closed: "text-tertiary",
    other: "text-tertiary",
};

export const StatusText = ({ status }: { status: string }) => (
    <span className={cx("inline-flex items-center gap-1.5 font-medium", statusTone[status] ?? "text-tertiary")}>
        <span className="size-1.5 rounded-full bg-current" />
        {status}
    </span>
);

const link = (url: string | null, text: string) =>
    url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
            {text}
        </a>
    ) : (
        <span className="font-medium text-primary">{text}</span>
    );

export const TasksTable = ({ tasks, title = "Tasks", description }: { tasks: Task[]; title?: string; description?: string }) => {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<string>("all");
    const [page, setPage] = useState(1);
    const [sort, setSort] = useState<SortDescriptor>({ column: "when", direction: "descending" });

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        const value = (t: Task): number | string => {
            switch (sort.column) {
                case "task":
                    return t.issue;
                case "status":
                    return t.status;
                case "hours":
                    return hours(t) ?? -1;
                case "repairs":
                    return t.repairs;
                case "cost":
                    return t.cost;
                default:
                    return t.finished ?? t.started ?? 0;
            }
        };
        return tasks
            .filter((t) => status === "all" || t.status === status)
            .filter((t) => !q || `${t.issue} ${t.title} ${t.project}`.toLowerCase().includes(q))
            .sort((a, b) => {
                const x = value(a);
                const y = value(b);
                const c = x < y ? -1 : x > y ? 1 : 0;
                return sort.direction === "ascending" ? c : -c;
            });
    }, [tasks, query, status, sort]);

    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    const shown = rows.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE);

    return (
        <TableCard.Root>
            <TableCard.Header
                title={title}
                badge={`${rows.length}`}
                description={description}
                contentTrailing={
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <Input
                            aria-label="Search tasks"
                            placeholder="Search"
                            icon={SearchLg}
                            size="sm"
                            value={query}
                            onChange={(v) => {
                                setQuery(v);
                                setPage(1);
                            }}
                            className="sm:w-56"
                        />
                        <Select
                            aria-label="Status"
                            size="sm"
                            className="sm:w-48"
                            selectedKey={status}
                            onSelectionChange={(k) => {
                                setStatus(String(k));
                                setPage(1);
                            }}
                            items={[
                                { id: "all", label: "Every status" },
                                { id: "in progress", label: "In progress" },
                                { id: "needs a person", label: "Needs a person" },
                                { id: "merged", label: "Merged" },
                                { id: "waiting", label: "Waiting on other work" },
                                { id: "closed", label: "Closed without a change" },
                            ]}
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                    </div>
                }
            />
            <Table aria-label={title} size="sm" sortDescriptor={sort} onSortChange={setSort}>
                <Table.Header>
                    <Table.Head id="task" label="Task" isRowHeader allowsSorting className="w-full min-w-72" />
                    <Table.Head id="status" label="Status" allowsSorting />
                    <Table.Head id="when" label="Finished" allowsSorting />
                    <Table.Head id="hours" label="Time" allowsSorting />
                    <Table.Head id="review" label="First-try review" />
                    <Table.Head id="repairs" label="Repairs" allowsSorting />
                    <Table.Head id="cost" label="API cost" allowsSorting />
                </Table.Header>
                <Table.Body items={shown} renderEmptyState={() => <p className="p-6 text-sm text-tertiary">No tasks match.</p>}>
                    {(t) => {
                        const ft = firstTry(t);
                        return (
                            <Table.Row id={`${t.project}-${t.issue}`}>
                                <Table.Cell>
                                    <div className="flex flex-col">
                                        {link(t.url, `#${t.issue} ${t.title}`)}
                                        <span className="text-xs text-tertiary">
                                            {t.project}
                                            {t.pr && (
                                                <>
                                                    {" · "}
                                                    <a href={t.pr} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                        PR #{t.pr.split("/").pop()}
                                                    </a>
                                                </>
                                            )}
                                            {t.blockedBecause && ` · ${t.blockedBecause}`}
                                        </span>
                                    </div>
                                </Table.Cell>
                                <Table.Cell className="whitespace-nowrap">
                                    <StatusText status={t.status} />
                                </Table.Cell>
                                <Table.Cell className="whitespace-nowrap tabular-nums">{t.finished ? when(t.finished) : "–"}</Table.Cell>
                                <Table.Cell className="whitespace-nowrap tabular-nums">{hoursText(hours(t))}</Table.Cell>
                                <Table.Cell className="whitespace-nowrap">{ft == null ? "–" : ft ? "Yes" : "No"}</Table.Cell>
                                <Table.Cell className="text-right tabular-nums">{t.repairs}</Table.Cell>
                                <Table.Cell className="text-right whitespace-nowrap tabular-nums">{money(t.cost)}</Table.Cell>
                            </Table.Row>
                        );
                    }}
                </Table.Body>
            </Table>
            <div className="flex items-center justify-between border-t border-secondary px-5 py-3 text-sm text-tertiary">
                <span>
                    Page {Math.min(page, pages)} of {pages}
                </span>
                <div className="flex gap-2">
                    <Button size="sm" color="secondary" isDisabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        Previous
                    </Button>
                    <Button size="sm" color="secondary" isDisabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                        Next
                    </Button>
                </div>
            </div>
        </TableCard.Root>
    );
};
