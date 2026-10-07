import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MdCheck, MdKeyboardArrowDown, MdKeyboardArrowUp } from "react-icons/md";
import { cn } from "../../lib/utils";

const SelectContext = createContext(null);

function Select({ value, defaultValue, onValueChange, children, disabled = false }) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState({});
  const rootRef = useRef(null);
  const currentValue = value ?? internalValue;

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const contextValue = useMemo(
    () => ({
      disabled,
      labels,
      onValueChange,
      open,
      registerLabel: (itemValue, label) =>
        setLabels((prev) => (prev[itemValue] === label ? prev : { ...prev, [itemValue]: label })),
      setInternalValue,
      setOpen,
      value: currentValue,
    }),
    [currentValue, disabled, labels, onValueChange, open]
  );

  return (
    <SelectContext.Provider value={contextValue}>
      <div ref={rootRef} data-slot="select" className="relative w-full">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

function useSelect() {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error("Select components must be used inside <Select>");
  }
  return context;
}

function SelectGroup({ className, ...props }) {
  return <div data-slot="select-group" className={className} {...props} />;
}

function SelectValue({ placeholder }) {
  const { labels, value } = useSelect();
  return (
    <span data-slot="select-value" className="block truncate">
      {labels[value] ?? placeholder ?? value}
    </span>
  );
}

function SelectTrigger({ className, size = "default", children, ...props }) {
  const { disabled, open, setOpen } = useSelect();

  return (
    <button
      type="button"
      data-slot="select-trigger"
      data-size={size}
      disabled={disabled}
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none transition-[border-color,box-shadow]",
        "focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      onClick={() => setOpen(!open)}
      {...props}
    >
      {children}
      {open ? (
        <MdKeyboardArrowUp className="size-4 text-slate-400" />
      ) : (
        <MdKeyboardArrowDown className="size-4 text-slate-400" />
      )}
    </button>
  );
}

function SelectContent({ className, children, ...props }) {
  const { open } = useSelect();

  return (
    <div
      data-slot="select-content"
      className={cn(
        "absolute left-0 top-[calc(100%+4px)] z-50 max-h-72 w-full min-w-32 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 text-slate-950 shadow-lg",
        open ? "block" : "hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function SelectLabel({ className, ...props }) {
  return (
    <div
      data-slot="select-label"
      className={cn("px-2 py-1 text-xs font-medium text-slate-500", className)}
      {...props}
    />
  );
}

function SelectItem({ className, value, children, ...props }) {
  const { onValueChange, registerLabel, setInternalValue, setOpen, value: selectedValue } = useSelect();
  const selected = selectedValue === value;

  useEffect(() => {
    registerLabel(value, typeof children === "string" ? children : String(value));
  }, [children, registerLabel, value]);

  return (
    <button
      type="button"
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-2.5 pr-8 text-left text-sm outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100",
        selected && "bg-slate-100 text-slate-950",
        className
      )}
      onClick={() => {
        setInternalValue(value);
        onValueChange?.(value);
        setOpen(false);
      }}
      {...props}
    >
      <span className="truncate">{children}</span>
      {selected && (
        <span className="absolute right-2 flex size-4 items-center justify-center text-blue-600">
          <MdCheck className="size-4" />
        </span>
      )}
    </button>
  );
}

function SelectSeparator({ className, ...props }) {
  return (
    <div
      data-slot="select-separator"
      className={cn("-mx-1 my-1 h-px bg-slate-100", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({ className, ...props }) {
  return (
    <div
      data-slot="select-scroll-up-button"
      className={cn("flex items-center justify-center py-1", className)}
      {...props}
    >
      <MdKeyboardArrowUp className="size-4" />
    </div>
  );
}

function SelectScrollDownButton({ className, ...props }) {
  return (
    <div
      data-slot="select-scroll-down-button"
      className={cn("flex items-center justify-center py-1", className)}
      {...props}
    >
      <MdKeyboardArrowDown className="size-4" />
    </div>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
