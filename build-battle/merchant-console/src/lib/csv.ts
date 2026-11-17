import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns (NWP-101). The card last four is opt-in, because
 * these files go to merchants.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

/** What an export contains when the caller does not choose: everything but last4. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

export type ParsedColumns =
  | { ok: true; columns: ExportColumn[] }
  | { ok: false; error: string }

/**
 * Validates a client-supplied `columns` param against the allowlist.
 * Absent means the defaults; order is kept, duplicates dropped, and an
 * unknown or empty selection is rejected rather than silently repaired.
 */
export function parseExportColumns(param: string | null): ParsedColumns {
  if (param === null) return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = param
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (requested.length === 0) {
    return { ok: false, error: "Choose at least one column to export." }
  }

  // Generic message: never echo client input back into the response.
  if (requested.some((name) => !(EXPORT_COLUMNS as readonly string[]).includes(name))) {
    return { ok: false, error: "Unknown export column." }
  }

  return { ok: true, columns: [...new Set(requested as ExportColumn[])] }
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      return formatMoney(payment.amount, payment.currency)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/** `scope` must already be an allowlisted label; it ends up in a response header. */
export function exportFilename(date = new Date(), scope?: string): string {
  const day = date.toISOString().slice(0, 10)
  return scope ? `payments-${scope}-${day}.csv` : `payments-${day}.csv`
}
