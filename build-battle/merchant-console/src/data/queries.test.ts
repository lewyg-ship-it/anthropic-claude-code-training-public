import { describe, expect, it } from "vitest"
import { Payment } from "./types"
import { parseFilters, sortPayments, validateFilterParams } from "./queries"

const base: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 25000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

const params = (query: string) => new URLSearchParams(query)

describe("sortPayments by amount", () => {
  it("compares integer minor units, not their string form", () => {
    const rows = [9000, 25000, 100].map((amount, i) => ({ ...base, id: `p${i}`, amount }))
    expect(sortPayments(rows, "amount", "asc").map((p) => p.amount)).toEqual([100, 9000, 25000])
    expect(sortPayments(rows, "amount", "desc").map((p) => p.amount)).toEqual([25000, 9000, 100])
  })

  it("never interleaves currencies", () => {
    const rows: Payment[] = [
      { ...base, id: "a", amount: 500, currency: "USD" },
      { ...base, id: "b", amount: 100, currency: "EUR" },
      { ...base, id: "c", amount: 300, currency: "USD" },
      { ...base, id: "d", amount: 900, currency: "EUR" },
    ]
    expect(sortPayments(rows, "amount", "asc").map((p) => p.id)).toEqual(["b", "d", "c", "a"])
  })
})

describe("validateFilterParams", () => {
  it("accepts known values and absent params", () => {
    expect(validateFilterParams(params(""))).toBeNull()
    expect(
      validateFilterParams(
        params("status=disputed&merchantId=mch_01&from=2026-07-01&to=2026-07-31T12:00:00Z&sort=amount&direction=asc&page=2"),
      ),
    ).toBeNull()
  })

  it("rejects values not on the allowlist or not a strict date", () => {
    expect(validateFilterParams(params("merchantId=mch_missing"))).toBe("Unknown merchant.")
    expect(validateFilterParams(params("status=pending"))).toBe("Unknown status.")
    expect(validateFilterParams(params("from=zzz"))).toBe("Invalid from date.")
    expect(validateFilterParams(params("to=2026-02-30"))).toBe("Invalid to date.")
    expect(validateFilterParams(params("sort=merchant"))).toBe("Unknown sort.")
    expect(validateFilterParams(params(`search=${"x".repeat(101)}`))).toBe("Search is too long.")
    for (const page of ["0", "1.5", "0x10", "1e3", "-2"]) {
      expect(validateFilterParams(params(`page=${page}`))).toBe("Invalid page.")
    }
  })
})

describe("parseFilters", () => {
  it("makes a bare to date inclusive of that whole UTC day", () => {
    const filters = parseFilters(params("from=2026-07-01&to=2026-07-31"))
    expect(filters.from).toBe("2026-07-01T00:00:00.000Z")
    expect(filters.to).toBe("2026-07-31T23:59:59.999Z")
  })

  it("never widens a query for an unknown merchant", () => {
    expect(parseFilters(params("merchantId=mch_missing")).merchantId).toBeTruthy()
    expect(parseFilters(params("merchantId=mch_missing")).merchantId).not.toBe("mch_missing")
  })
})
