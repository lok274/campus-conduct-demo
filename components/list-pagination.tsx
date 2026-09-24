"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem } from "./ui/pagination";
import { pageWindow } from "../lib/list-tools";

export function useListPage<T>(items: T[], resetKey: string) {
  const [state, setState] = useState({ key: resetKey, page: 1, pageSize: 25 });
  // Reset synchronously when criteria change; data-only changes only clamp the page.
  if (state.key !== resetKey) setState({ ...state, key: resetKey, page: 1 });
  const range = pageWindow(items.length, state.key === resetKey ? state.page : 1, state.pageSize);
  return {
    ...range,
    items: items.slice(range.start ? range.start - 1 : 0, range.end),
    onPage: (page: number) => setState(current => ({ ...current, key: resetKey, page })),
    onPageSize: (pageSize: number) => setState({ key: resetKey, page: 1, pageSize }),
  };
}
export type ListPage = ReturnType<typeof useListPage>;
export function ListPagination({ page, unit = "筆", label }: { page: ListPage; unit?: string; label: string }) {
  return <div className="list-pagination">
    <p role="status" aria-live="polite">第 {page.start}–{page.end} 筆，共 <strong>{page.total.toLocaleString()}</strong> {unit}</p>
    <label>每頁 <select aria-label={label + "每頁筆數"} value={page.pageSize} onChange={event => page.onPageSize(Number(event.target.value))}>
      {[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
    </select> 筆</label>
    <Pagination aria-label={label + "分頁"}>
      <PaginationContent>
        <PaginationItem><button type="button" className="btn secondary" aria-label={label + "上一頁"} disabled={page.page === 1} onClick={() => page.onPage(page.page - 1)}><ChevronLeft size={16}/><span>上一頁</span></button></PaginationItem>
        <PaginationItem><span className="page-position">{page.page} / {page.pages}</span></PaginationItem>
        <PaginationItem><button type="button" className="btn secondary" aria-label={label + "下一頁"} disabled={page.page === page.pages} onClick={() => page.onPage(page.page + 1)}><span>下一頁</span><ChevronRight size={16}/></button></PaginationItem>
      </PaginationContent>
    </Pagination>
  </div>;
}
