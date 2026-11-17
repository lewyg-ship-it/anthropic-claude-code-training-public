import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { GET } from "./route"

const get = (query: string) =>
  GET(new NextRequest(`http://localhost/api/payments/export?${query}`))

const rowsOf = async (response: Response) => (await response.text()).split("\n").slice(1)

describe("GET /api/payments/export", () => {
  it("leaves last four out by default and names the file for the scope", async () => {
    const response = await get("status=disputed")
    expect(response.status).toBe(200)
    expect((await response.clone().text()).split("\n")[0].split(",")).not.toContain("last4")
    expect(response.headers.get("content-disposition")).toMatch(
      /filename="payments-disputed-\d{4}-\d{2}-\d{2}\.csv"/,
    )
  })

  it("exports every matching row, not one page", async () => {
    const filtered = await rowsOf(await get("status=disputed&columns=status"))
    expect(filtered.length).toBeGreaterThan(20)
    expect(new Set(filtered)).toEqual(new Set(["disputed"]))
  })

  it("ignores the filters for scope=all", async () => {
    const all = await rowsOf(await get("scope=all&status=disputed&columns=id"))
    const filtered = await rowsOf(await get("status=disputed&columns=id"))
    expect(all.length).toBeGreaterThan(filtered.length)
  })

  it.each([
    ["scope=page", "Unknown export scope."],
    ["columns=", "Choose at least one column to export."],
    ["columns=id,card_number", "Unknown export column."],
    ["merchantId=mch_missing", "Unknown merchant."],
    ["from=zzz", "Invalid from date."],
  ])("rejects %s with 400", async (query, message) => {
    const response = await get(query)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: message })
  })
})
