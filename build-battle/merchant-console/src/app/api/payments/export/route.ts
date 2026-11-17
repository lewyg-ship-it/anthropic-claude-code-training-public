import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

const SCOPES = ["filter", "all"] as const
type Scope = (typeof SCOPES)[number]

/**
 * Exports the payments table as CSV, across every page, through the shared
 * query builder. Ops chooses the columns and the scope (NWP-101); both are
 * validated here because they arrive from the client.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scopeParam = params.get("scope") ?? "filter"
  if (!(SCOPES as readonly string[]).includes(scopeParam)) {
    return NextResponse.json({ error: "Unknown export scope." }, { status: 400 })
  }
  const scope = scopeParam as Scope

  const parsed = parseExportColumns(params.get("columns"))
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const filters = parseFilters(params)
  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  // Only allowlisted values reach the filename: never search text or ids.
  const label =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "filtered"

  return new Response(toCsv(rows, parsed.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label)}"`,
    },
  })
}
