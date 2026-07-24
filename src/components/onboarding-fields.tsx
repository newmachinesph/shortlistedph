"use client";

import { X } from "lucide-react";

/**
 * Shared wizard inputs. Every control is full width and at least 44px tall,
 * and every text input renders at 16px — below that iOS Safari zooms the page
 * on focus and the talent loses their place mid-form.
 */

const inputClass =
  "w-full min-h-[44px] rounded-xl border border-line bg-paper px-3 py-3 text-base text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand";

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  onEnter,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "url" | "numeric" | "decimal";
  /** Enter submits an "add to list" action, matching the other chip inputs. */
  onEnter?: () => void;
}) {
  return (
    <input
      id={id}
      type={type}
      inputMode={inputMode}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={
        onEnter
          ? (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter();
              }
            }
          : undefined
      }
      className={inputClass}
    />
  );
}

export function TextArea({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  );
}

export function Select({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ChipList({
  items,
  onRemove,
  locked,
}: {
  items: string[];
  onRemove: (item: string) => void;
  locked?: (item: string) => boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-faint">Nothing here yet.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => {
        const isLocked = locked?.(item) ?? false;
        return (
          <li key={item}>
            {isLocked ? (
              <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-sm text-brand">
                {item}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onRemove(item)}
                aria-label={`Remove ${item}`}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-ember hover:text-ember"
              >
                {item}
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
