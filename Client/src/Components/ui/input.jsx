import { cn } from "../../lib/utils";

function Input({ className, type, ...props }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none transition-[border-color,box-shadow]",
        "placeholder:text-slate-400",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-900",
        "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
