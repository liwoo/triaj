"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    sticky?: "right";
  }
}
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ColumnFilterConfig {
  columnId: string;
  label: string;
  options: { value: string; label: string }[];
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  searchPlaceholder?: string;
  globalFilterKeys?: (keyof T)[];
  columnFilters?: ColumnFilterConfig[];
  pageSize?: number;
  emptyMessage?: string;
}

const ALL_VALUE = "__all__";

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = "Search…",
  globalFilterKeys,
  columnFilters = [],
  pageSize = 10,
  emptyMessage = "No rows to display.",
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters: filters, globalFilter },
    initialState: { pagination: { pageSize } },
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, value) => {
      if (!value) return true;
      const needle = String(value).toLowerCase();
      if (globalFilterKeys?.length) {
        return globalFilterKeys.some((k) => {
          const v = (row.original as any)[k];
          return v != null && String(v).toLowerCase().includes(needle);
        });
      }
      return row.getAllCells().some((cell) => {
        const v = cell.getValue();
        return v != null && String(v).toLowerCase().includes(needle);
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const filterState = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of filters) map[f.id] = String(f.value ?? "");
    return map;
  }, [filters]);

  const setColumnFilter = (columnId: string, value: string) => {
    setFilters((prev) => {
      const next = prev.filter((f) => f.id !== columnId);
      if (value && value !== ALL_VALUE) next.push({ id: columnId, value });
      return next;
    });
  };

  const hasFilters = filters.length > 0 || !!globalFilter;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-bold text-govuk-black dark:text-govuk-white">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-govuk-dark-grey" />
            <Input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-72 pl-8"
            />
          </div>
        </div>
        {columnFilters.map((cf) => (
          <div key={cf.columnId} className="flex flex-col gap-1">
            <label className="text-sm font-bold text-govuk-black dark:text-govuk-white">
              {cf.label}
            </label>
            <Select
              value={filterState[cf.columnId] || ALL_VALUE}
              onValueChange={(v) => setColumnFilter(cf.columnId, v)}
            >
              <SelectTrigger className="h-10 w-[200px] border-[2px] border-govuk-black bg-govuk-white text-govuk-black dark:border-govuk-mid-grey dark:bg-govuk-black dark:text-govuk-white">
                <SelectValue placeholder={cf.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All</SelectItem>
                {cf.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setFilters([]);
              setGlobalFilter("");
            }}
          >
            Clear filters
          </Button>
        )}
        <div className="ml-auto pb-1 text-sm text-govuk-dark-grey dark:text-govuk-mid-grey">
          Showing <strong>{table.getFilteredRowModel().rows.length}</strong> of{" "}
          <strong>{data.length}</strong>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="border-b-[1px] border-govuk-mid-grey"
              >
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sortDir = h.column.getIsSorted();
                  const stickyRight =
                    h.column.columnDef.meta?.sticky === "right";
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      className={cn(
                        "whitespace-nowrap px-4 py-3 align-bottom text-sm font-bold text-govuk-black dark:text-govuk-white",
                        canSort && "cursor-pointer select-none",
                        stickyRight &&
                          "sticky right-0 z-20 border-l border-govuk-mid-grey bg-govuk-white shadow-[-6px_0_6px_-4px_rgba(0,0,0,0.08)] dark:bg-govuk-black",
                      )}
                      onClick={
                        canSort ? h.column.getToggleSortingHandler() : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {canSort && (
                          <span className="text-govuk-dark-grey">
                            {sortDir === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : sortDir === "desc" ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3" />
                            )}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="border-b-[1px] border-govuk-mid-grey py-10 text-center text-sm text-govuk-dark-grey dark:text-govuk-mid-grey"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="group/row border-b-[1px] border-govuk-mid-grey align-middle"
              >
                {row.getVisibleCells().map((cell) => {
                  const stickyRight =
                    cell.column.columnDef.meta?.sticky === "right";
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        "whitespace-nowrap px-4 py-3 text-sm text-govuk-black dark:text-govuk-white",
                        stickyRight &&
                          "sticky right-0 z-10 border-l border-govuk-mid-grey bg-govuk-white shadow-[-6px_0_6px_-4px_rgba(0,0,0,0.08)] dark:bg-govuk-black",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-govuk-dark-grey dark:text-govuk-mid-grey">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount() || 1}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
