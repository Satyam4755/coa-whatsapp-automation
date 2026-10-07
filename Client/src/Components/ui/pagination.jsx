import { useState } from "react";
import {
  MdChevronLeft,
  MdChevronRight,
  MdFirstPage,
  MdLastPage,
  MdMoreHoriz,
} from "react-icons/md";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

function Pagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  className = "",
  pageSize,
  pageSizeOptions = [10, 50, 100],
  onPageSizeChange,
}) {
  const [pageInputValue, setPageInputValue] = useState("");

  const handlePageJump = () => {
    const page = parseInt(pageInputValue, 10);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
      setPageInputValue("");
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let page = 1; page <= totalPages; page += 1) pages.push(page);
      return pages;
    }

    pages.push(1);
    if (currentPage > 3) pages.push("ellipsis-start");

    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);
    if (currentPage <= 3) end = 4;
    if (currentPage >= totalPages - 2) start = totalPages - 3;

    for (let page = start; page <= end; page += 1) pages.push(page);
    if (currentPage < totalPages - 2) pages.push("ellipsis-end");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className={`flex min-w-0 flex-wrap items-center justify-center gap-2 ${className}`}>
      <div className="flex min-w-0 flex-wrap items-center justify-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-md border-slate-200 bg-white p-0 hover:bg-slate-100 disabled:opacity-50"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
        >
          <MdFirstPage className="h-4 w-4" />
          <span className="sr-only">First page</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-md border-slate-200 bg-white p-0 hover:bg-slate-100 disabled:opacity-50"
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <MdChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous page</span>
        </Button>

        {getPageNumbers().map((page, index) =>
          page === "ellipsis-start" || page === "ellipsis-end" ? (
            <div key={`ellipsis-${index}`} className="flex h-8 w-8 items-center justify-center">
              <MdMoreHoriz className="h-4 w-4 text-slate-500" />
            </div>
          ) : (
            <Button
              key={page}
              variant={currentPage === page ? "secondary" : "outline"}
              size="icon"
              className={cn(
                "h-8 w-8 rounded-md p-0 text-sm font-medium transition-colors",
                currentPage === page
                  ? "border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200"
                  : "border-slate-200 bg-white hover:bg-slate-100"
              )}
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-md border-slate-200 bg-white p-0 hover:bg-slate-100 disabled:opacity-50"
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <MdChevronRight className="h-4 w-4" />
          <span className="sr-only">Next page</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-md border-slate-200 bg-white p-0 hover:bg-slate-100 disabled:opacity-50"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          <MdLastPage className="h-4 w-4" />
          <span className="sr-only">Last page</span>
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap sm:ml-2">
        <span className="hidden text-sm text-slate-500 sm:inline-block">Go to</span>
        <Input
          type="number"
          min="1"
          max={totalPages}
          value={pageInputValue}
          onChange={(event) => setPageInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handlePageJump();
          }}
          placeholder="#"
          className="!h-8 !min-h-8 !w-12 !min-w-12 shrink-0 rounded-md border-slate-200 !p-0 text-center"
        />
      </div>

      {onPageSizeChange && (
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap sm:ml-2">
          <span className="hidden text-sm text-slate-500 sm:inline-block">Show</span>
          <div className="w-20">
            <Select
              value={String(pageSize || pageSizeOptions[0])}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="!h-8 !min-h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

export { Pagination };
