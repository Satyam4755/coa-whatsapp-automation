import { isValidElement } from "react";
import { MdRefresh, MdSearch } from "react-icons/md";
import { cn } from "../../lib/utils";
import { Button } from "./button";

function EmptyState({
  title = "No results found",
  description = "Try adjusting your search or filters",
  icon,
  onReset,
  timer = null,
  className,
}) {
  const IconComponent = icon || MdSearch;

  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-12", className)}>
      <div className="space-y-4 text-center">
        <div className="text-slate-500">
          {isValidElement(IconComponent) ? (
            IconComponent
          ) : (
            <IconComponent className="mx-auto mb-3 h-12 w-12 opacity-50" />
          )}
          <h3 className="text-lg font-medium text-slate-900">{title}</h3>
          <p className="mt-2 text-sm">{description}</p>
        </div>
        {onReset && (
          <div className="flex flex-col items-center gap-3">
            <Button variant="outline" onClick={onReset}>
              <MdRefresh className="mr-2 h-4 w-4" />
              Reset Filters
            </Button>
            {timer !== null && (
              <p className="text-xs text-slate-500">
                Auto-resetting in {timer} seconds...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { EmptyState };
