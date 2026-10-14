"use client";

import { type ReactNode, useMemo, useState } from "react";
import type { Selection, SortDescriptor } from "react-aria-components";
import { Columns03, SearchLg } from "@untitledui/icons";
import { Table, TableCard } from "@/components/application/table/table";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Input } from "@/components/base/input/input";

export interface Column<T> {
    id: string;
    label: string;
    value: (row: T) => number | string | null; // sort key and search text
    render?: (row: T) => ReactNode;
}

/** The house table: dark header, left-aligned cells, search, sort and a column picker. */
export function DataTable<T>({
    title,
    rows,
    columns,
    rowKey,
    empty = "Nothing to show.",
    controls,
}: {
    title: string;
    rows: T[];
    columns: Column<T>[];
    rowKey: (row: T) => string;
    empty?: string;
    controls?: ReactNode;
}) {
    const [query, setQuery] = useState("");
    const [shown, setShown] = useState<Selection>(new Set(columns.map((c) => c.id)));
    const [sort, setSort] = useState<SortDescriptor>({ column: columns[0].id, direction: "ascending" });

    const visible = columns.filter((c, i) => i === 0 || shown === "all" || shown.has(c.id));
    const sorted = useMemo(() => {
        const q = query.trim().toLowerCase();
        const col = columns.find((c) => c.id === sort.column) ?? columns[0];
        return rows
            .filter((r) => !q || columns.some((c) => String(c.value(r) ?? "").toLowerCase().includes(q)))
            .sort((a, b) => {
                const x = col.value(a);
                const y = col.value(b);
                if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1; // blanks last
                const c = x < y ? -1 : x > y ? 1 : 0;
                return sort.direction === "ascending" ? c : -c;
            });
    }, [rows, columns, query, sort]);

    return (
        <TableCard.Root>
            <TableCard.Header
                title={title}
                badge={`${sorted.length}`}
                contentTrailing={
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <Input aria-label={`Search ${title}`} placeholder="Search" icon={SearchLg} size="sm" value={query} onChange={setQuery} className="sm:w-48" />
                        {controls}
                        <Dropdown.Root>
                            <Button size="sm" color="secondary" iconLeading={Columns03}>
                                Columns
                            </Button>
                            <Dropdown.Popover className="w-64">
                                <Dropdown.Menu selectionMode="multiple" selectedKeys={shown} onSelectionChange={setShown} disabledKeys={[columns[0].id]}>
                                    {columns.map((c) => (
                                        <Dropdown.Item key={c.id} id={c.id}>
                                            {c.label}
                                        </Dropdown.Item>
                                    ))}
                                </Dropdown.Menu>
                            </Dropdown.Popover>
                        </Dropdown.Root>
                    </div>
                }
            />
            <Table aria-label={title} size="sm" sortDescriptor={sort} onSortChange={setSort}>
                <Table.Header className="bg-[#050E30]" bordered={false}>
                    {visible.map((c, i) => (
                        <Table.Head key={c.id} id={c.id} isRowHeader={i === 0} allowsSorting className="text-left [&_svg]:text-white">
                            <span className="text-xs font-semibold whitespace-nowrap text-white">{c.label}</span>
                        </Table.Head>
                    ))}
                </Table.Header>
                <Table.Body items={sorted.map((r) => ({ id: rowKey(r), r }))} dependencies={[visible]} renderEmptyState={() => <p className="p-6 text-sm text-tertiary">{empty}</p>}>
                    {({ id, r }) => (
                        <Table.Row id={id}>
                            {visible.map((c) => (
                                <Table.Cell key={c.id} className="text-left whitespace-nowrap tabular-nums">
                                    {c.render ? c.render(r) : (c.value(r) ?? "–")}
                                </Table.Cell>
                            ))}
                        </Table.Row>
                    )}
                </Table.Body>
            </Table>
        </TableCard.Root>
    );
}
