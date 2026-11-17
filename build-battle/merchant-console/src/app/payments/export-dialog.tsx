"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

type Scope = "filter" | "all"

/**
 * Export options for the payments table. The file is built on the server
 * across every page; this only chooses what goes in it.
 */
export function ExportDialog({
  query,
  filteredCount,
  allCount,
}: {
  /** The page's current filter query string. */
  query: string
  filteredCount: number
  allCount: number
}) {
  const [columns, setColumns] = useState<ExportColumn[]>([...DEFAULT_EXPORT_COLUMNS])
  const [scope, setScope] = useState<Scope>("filter")

  const toggle = (column: ExportColumn, checked: boolean) =>
    setColumns((current) =>
      // Keep the canonical column order whatever order they are ticked in.
      EXPORT_COLUMNS.filter((c) => (c === column ? checked : current.includes(c))),
    )

  const rowCount = scope === "all" ? allCount : filteredCount
  const href = (() => {
    const params = new URLSearchParams(query)
    params.delete("page")
    params.set("scope", scope)
    params.set("columns", columns.join(","))
    return `/api/payments/export?${params.toString()}`
  })()

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>Choose what goes in the CSV.</DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["filter", "Current filter", filteredCount],
                  ["all", "All payments", allCount],
                ] as const
              ).map(([value, label, count]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="export-scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="size-4 accent-blue-600"
                  />
                  {label}
                  <span className="text-gray-500 tabular-nums">
                    ({count.toLocaleString()} rows)
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {EXPORT_COLUMNS.map((column) => (
                <label key={column} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={columns.includes(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                    className="size-4 accent-blue-600"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {columns.length === 0 && (
              <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-500">
                Choose at least one column to export.
              </p>
            )}
          </fieldset>

          <p className="text-sm text-gray-500" aria-live="polite">
            {rowCount.toLocaleString()} rows will be exported.
          </p>
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="mt-2 sm:mt-0">
              Cancel
            </Button>
          </DrawerClose>
          {columns.length === 0 ? (
            <Button variant="primary" disabled>
              Download CSV
            </Button>
          ) : (
            <Button variant="primary" asChild>
              <a href={href} download>
                Download CSV
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
