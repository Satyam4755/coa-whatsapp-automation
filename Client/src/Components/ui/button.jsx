import { cn } from "../../lib/utils";

const variants = {
  default:
    "bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]",
  destructive:
    "border border-red-200 bg-red-50 text-red-700 shadow-sm hover:bg-red-600 hover:text-white",
  outline:
    "border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50",
  secondary:
    "border border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  link: "h-auto p-0 text-blue-600 underline-offset-4 hover:underline",
  soft:
    "border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100",
};

const sizes = {
  default: "h-9 px-4 py-1.5",
  sm: "h-7 rounded-md px-3 text-xs",
  lg: "h-10 px-6 text-sm",
  icon: "size-9",
  "icon-sm": "size-7 rounded-md",
  "icon-lg": "size-10",
};

function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-[0.8rem] font-medium outline-none transition-all disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-1",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export { Button };
