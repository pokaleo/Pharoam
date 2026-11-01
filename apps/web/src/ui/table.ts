/**
 * The classes every table shares.
 *
 * @packageDocumentation
 */

/**
 * The design system's table: rules and alignment, no zebra rows, no header band.
 *
 * @remarks Headers are small grey sentence case on one rule; rows are a fixed height on a soft rule, the last row
 * without one; the identity column is a row header in the full ink. The first and last columns sit flush with the
 * table's edges.
 */
export const TABLE = {
  /** The table itself. */
  table: "w-full border-collapse text-body",
  /** A column header. */
  head: "border-b border-line px-3 pb-2 text-start align-bottom text-meta font-normal whitespace-nowrap text-ink-2 first:ps-0 last:pe-0",
  /** A cell. */
  cell: "h-(--row) border-b border-line-soft px-3 align-middle first:ps-0 last:pe-0 [tr:last-child_&]:border-b-0",
  /** The row header that names the row, such as a skill. */
  rowHead:
    "h-(--row) border-b border-line-soft pe-3 text-start align-middle font-semibold text-ink [tr:last-child_&]:border-b-0",
  /** A row that starts a group, such as a domain, across every column. */
  group:
    "h-auto border-b border-line pt-[18px] pb-1.5 text-start text-meta font-semibold text-ink-2 first:ps-0",
  /** A figure, right-aligned in tabular digits. */
  figure: "text-end tabular-nums",
} as const;
