"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "@untitledui/icons";
import { cx } from "@/utils/cx";

/** A headline number with its change against the previous window of the same length. */
export const MetricCard = ({
    title,
    value,
    delta,
    goodWhen = "up",
    footnote,
}: {
    title: string;
    value: ReactNode;
    delta?: number | null;
    goodWhen?: "up" | "down";
    footnote?: ReactNode;
}) => {
    const hasDelta = delta != null && Number.isFinite(delta) && Math.abs(delta) >= 0.005;
    const up = (delta ?? 0) > 0;
    const good = hasDelta && (goodWhen === "up" ? up : !up);
    return (
        <div className="flex flex-col gap-3 rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset">
            <h3 className="text-sm font-medium text-tertiary">{title}</h3>
            <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-display-sm font-semibold text-primary tabular-nums">{value}</p>
                {hasDelta && (
                    <span
                        className={cx(
                            "inline-flex items-center gap-0.5 text-sm font-medium tabular-nums",
                            good ? "text-success-primary" : "text-error-primary",
                        )}
                        title="Change against the previous period of the same length"
                    >
                        {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                        {Math.round(Math.abs(delta!) * 100)}%
                    </span>
                )}
            </div>
            {footnote && <p className="text-xs text-tertiary">{footnote}</p>}
        </div>
    );
};

/** A titled card holding one chart or table. */
export const ChartCard = ({
    title,
    description,
    actions,
    children,
    className,
}: {
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}) => (
    <section className={cx("flex min-w-0 flex-col rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset", className)}>
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-secondary px-5 py-4">
            <div className="min-w-0">
                <h3 className="text-md font-semibold text-primary">{title}</h3>
                {description && <p className="mt-0.5 text-sm text-tertiary">{description}</p>}
            </div>
            {actions}
        </header>
        <div className="min-w-0 flex-1 p-5">{children}</div>
    </section>
);

export const Empty = ({ children = "Nothing in this period." }: { children?: ReactNode }) => (
    <div className="flex h-full min-h-40 items-center justify-center text-sm text-tertiary">{children}</div>
);
