// Categorical colors, assigned in a fixed order and kept by entity: a model or a failure
// category keeps its color whatever the filters show. These are the dataviz skill's validated
// eight-slot palette (light and dark steps), exposed as CSS variables in globals.css.
export const SLOTS = 8;

export const seriesColor = (index: number) => (index < SLOTS ? `var(--series-${index + 1})` : "var(--series-other)");

export function colorMap(order: string[]) {
    const map = new Map<string, string>();
    order.forEach((name, i) => map.set(name, seriesColor(i)));
    return (name: string) => map.get(name) ?? "var(--series-other)";
}
