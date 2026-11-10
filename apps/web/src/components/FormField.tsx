import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";

/**
 * Accessible form field: the <label> is tied to the input (htmlFor/id), errors are announced
 * (role="alert") and linked with aria-describedby, and invalid state is exposed to screen readers.
 */
interface BaseProps {
  label: string;
  error?: string;
  hint?: string;
}

export function FormField({ label, error, hint, ...input }: BaseProps & ComponentProps<"input">) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {input.required && (
          <span aria-hidden className="text-red-600">
            {" "}
            *
          </span>
        )}
      </label>
      <input id={id} className="input" aria-invalid={!!error} aria-describedby={describedBy} {...input} />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({ label, error, hint, ...input }: BaseProps & ComponentProps<"textarea">) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {input.required && (
          <span aria-hidden className="text-red-600">
            {" "}
            *
          </span>
        )}
      </label>
      <textarea id={id} className="input min-h-28" aria-invalid={!!error} aria-describedby={describedBy} {...input} />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  error,
  children,
  ...select
}: BaseProps & ComponentProps<"select"> & { children: ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select id={id} className="input" aria-invalid={!!error} {...select}>
        {children}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
