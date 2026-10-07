import { cn } from "../../lib/utils";

function Textarea({ className, ...props }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-[border-color,box-shadow]",
        "placeholder:text-slate-400",
        "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
