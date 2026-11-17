import { merchantById } from "./merchants"
import { store } from "./store"
import { Payment, PaymentFilters, PaymentStatus } from "./types"

const STATUSES: readonly (PaymentStatus | "all")[] = [
  "all",
  "authorized",
  "captured",
  "refunded",
  "failed",
  "disputed",
]

const SEARCH_MAX_LENGTH = 100
/** Matches no payment, so an unknown merchant id narrows a query to nothing. */
const UNKNOWN_MERCHANT = "\u0000unknown"
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/

/**
 * A client `from`/`to` as a UTC ISO instant, or null if it is not a strict
 * date. A bare `to` date means the end of that UTC day, so it is inclusive.
 */
function parseBoundary(value: string | null, edge: "from" | "to"): string | null {
  if (!value) return null
  let candidate = value
  if (DATE_ONLY.test(value)) {
    candidate = `${value}T${edge === "from" ? "00:00:00.000" : "23:59:59.999"}Z`
  } else if (!ISO_INSTANT.test(value)) {
    return null
  }
  const time = Date.parse(candidate)
  if (Number.isNaN(time)) return null
  const iso = new Date(time).toISOString()
  // Date.parse rolls impossible dates over (Feb 30 → Mar 2); reject those.
  return iso.slice(0, 10) === value.slice(0, 10) ? iso : null
}

/**
 * Checks every filter param from the client against its allowlist or format.
 * Returns a message safe to show a user, or null when all present params are
 * valid. Route handlers reject with 400 rather than guessing what was meant.
 */
export function validateFilterParams(params: URLSearchParams): string | null {
  const status = params.get("status")
  if (status && !STATUSES.includes(status as PaymentStatus)) return "Unknown status."
  const merchantId = params.get("merchantId")
  if (merchantId && !merchantById(merchantId)) return "Unknown merchant."
  if (params.get("from") && !parseBoundary(params.get("from"), "from")) return "Invalid from date."
  if (params.get("to") && !parseBoundary(params.get("to"), "to")) return "Invalid to date."
  if ((params.get("search") ?? "").length > SEARCH_MAX_LENGTH) return "Search is too long."
  const sort = params.get("sort")
  if (sort && sort !== "amount" && sort !== "createdAt") return "Unknown sort."
  const direction = params.get("direction")
  if (direction && direction !== "asc" && direction !== "desc") return "Unknown sort direction."
  const page = params.get("page")
  if (page && !/^[1-9]\d{0,5}$/.test(page)) return "Invalid page."
  return null
}

/**
 * Anything from the client is checked against an allowlist before it reaches
 * a query. Route handlers call this rather than reading params themselves.
 * Invalid values never widen a query; routes reject them first with
 * `validateFilterParams`.
 */
export function parseFilters(params: URLSearchParams): PaymentFilters {
  const status = params.get("status")
  const sort = params.get("sort")
  const direction = params.get("direction")
  const page = Number(params.get("page") ?? "1")
  const merchantId = params.get("merchantId")
  const search = params.get("search")

  return {
    status: STATUSES.includes(status as PaymentStatus)
      ? (status as PaymentStatus)
      : "all",
    merchantId: merchantId ? (merchantById(merchantId)?.id ?? UNKNOWN_MERCHANT) : undefined,
    search: search ? search.slice(0, SEARCH_MAX_LENGTH) : undefined,
    from: parseBoundary(params.get("from"), "from") ?? undefined,
    to: parseBoundary(params.get("to"), "to") ?? undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    sort: sort === "amount" ? "amount" : "createdAt",
    direction: direction === "asc" ? "asc" : "desc",
  }
}

/**
 * The one payment query builder. Every list, export, and metric goes through
 * it. A second implementation is a defect, not a shortcut.
 */

export const PAGE_SIZE = 20

export function filterPayments(filters: PaymentFilters): Payment[] {
  const { status, merchantId, search, from, to } = filters
  const needle = search?.trim().toLowerCase()

  return store.payments.filter((payment) => {
    if (status && status !== "all" && payment.status !== status) return false
    if (merchantId && payment.merchantId !== merchantId) return false
    if (from && payment.createdAt < from) return false
    if (to && payment.createdAt > to) return false

    if (needle) {
      const merchant = merchantById(payment.merchantId)
      const haystack = [
        payment.id,
        payment.description,
        payment.last4 ?? "",
        merchant?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }

    return true
  })
}

export function sortPayments(
  payments: Payment[],
  sort: PaymentFilters["sort"] = "createdAt",
  direction: PaymentFilters["direction"] = "desc",
): Payment[] {
  const factor = direction === "asc" ? 1 : -1
  return [...payments].sort((a, b) => {
    if (sort === "amount") {
      // Integer minor units only mean something within one currency, so
      // group by currency first, then compare the integers.
      if (a.currency !== b.currency) return a.currency.localeCompare(b.currency)
      return (a.amount - b.amount) * factor
    }
    return a.createdAt.localeCompare(b.createdAt) * factor
  })
}

export function paginate<T>(rows: T[], page = 1, pageSize = PAGE_SIZE) {
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const start = (current - 1) * pageSize
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page: current,
    pageCount,
    pageSize,
  }
}

/** Filter, sort, and paginate in one call. Use this rather than composing by hand. */
export function queryPayments(filters: PaymentFilters) {
  const filtered = filterPayments(filters)
  const sorted = sortPayments(filtered, filters.sort, filters.direction)
  return paginate(sorted, filters.page, filters.pageSize)
}

export function paymentById(id: string) {
  return store.payments.find((p) => p.id === id) ?? null
}

export function refundsForPayment(paymentId: string) {
  return store.refunds.filter((r) => r.paymentId === paymentId)
}

export function disputeForPayment(paymentId: string) {
  return store.disputes.find((d) => d.paymentId === paymentId) ?? null
}
