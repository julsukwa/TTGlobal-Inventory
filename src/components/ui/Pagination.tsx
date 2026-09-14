import { ChevronLeft, ChevronRight } from "lucide-react";
import "./Pagination.css";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

type PageItem = number | "ellipsis";

const MAX_PAGE_BUTTONS = 5;

/** Builds the list of page numbers/ellipsis markers to render, always
 * including the first and last page and keeping the total number of
 * numbered buttons at or below MAX_PAGE_BUTTONS. */
function getPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= MAX_PAGE_BUTTONS) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const first = 1;
  const last = totalPages;
  const middleSlots = MAX_PAGE_BUTTONS - 2; // slots between first and last

  let start = Math.max(currentPage - 1, first + 1);
  let end = Math.min(currentPage + 1, last - 1);

  if (end - start + 1 < middleSlots) {
    if (currentPage - first < last - currentPage) {
      end = Math.min(start + middleSlots - 1, last - 1);
    } else {
      start = Math.max(end - middleSlots + 1, first + 1);
    }
  }

  const items: PageItem[] = [first];
  if (start > first + 1) items.push("ellipsis");
  for (let page = start; page <= end; page++) items.push(page);
  if (end < last - 1) items.push("ellipsis");
  items.push(last);

  return items;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageItems = getPageItems(currentPage, totalPages);

  return (
    <div className="ui-pagination">
      <button
        className="ui-pagination-arrow"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      {pageItems.map((item, index) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="ui-pagination-ellipsis">
            &hellip;
          </span>
        ) : (
          <button
            key={item}
            className={
              item === currentPage
                ? "ui-pagination-page ui-pagination-page-active"
                : "ui-pagination-page"
            }
            aria-current={item === currentPage ? "page" : undefined}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        )
      )}

      <button
        className="ui-pagination-arrow"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
