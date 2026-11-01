/**
 * Form fields: a label above the control, an optional hint, and what to fix, all tied to the control.
 *
 * @packageDocumentation
 */
import { CircleAlert } from "lucide-react";
import {
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Icon } from "./icon.tsx";

/**
 * The look of every text control: on the white sheet, with a boundary strong enough to see (WCAG 1.4.11), darker on
 * hover, and a double-weight red edge when it needs fixing.
 */
export const CONTROL =
  "min-h-(--control) w-full rounded-md border border-line-strong bg-surface px-2.5 text-ink transition-[border-color] duration-(--dur-feedback) ease-(--ease) placeholder:text-ink-3 hover:border-ink-2 aria-invalid:border-2 aria-invalid:border-problem disabled:cursor-not-allowed disabled:bg-panel disabled:text-ink-3";

interface FieldProps {
  /** What the field asks for. */
  readonly label: string;
  /** A sentence that helps answer, read with the field. */
  readonly hint?: string | undefined;
  /** What to fix, in plain words, shown next to the field and read with it (MVP S4.4). */
  readonly error?: string | undefined;
}

/** The IDs and attributes that tie a control to its label, hint and error. */
interface ControlProps {
  readonly id: string;
  readonly "aria-describedby": string | undefined;
  readonly "aria-invalid": true | undefined;
}

// The label, hint and error around a control, which gets the attributes that tie it to them.
function Field({
  label,
  hint,
  error,
  control,
}: FieldProps & { readonly control: (props: ControlProps) => ReactNode }): ReactElement {
  const id = useId();
  const described = [hint === undefined ? "" : `${id}-hint`, error === undefined ? "" : `${id}-error`]
    .filter((part) => part !== "")
    .join(" ");
  return (
    <div className="grid max-w-[56ch] gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {control({
        id,
        "aria-describedby": described === "" ? undefined : described,
        "aria-invalid": error === undefined ? undefined : true,
      })}
      {hint === undefined ? null : (
        <p id={`${id}-hint`} className="text-meta text-ink-2">
          {hint}
        </p>
      )}
      {error === undefined ? null : (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-meta text-problem">
          <Icon of={CircleAlert} size="sm" />
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * A one-line text field.
 *
 * @param props - The label, an optional hint and error, and the input's attributes.
 * @returns The labelled field.
 */
export function TextField({
  label,
  hint,
  error,
  ...input
}: FieldProps & InputHTMLAttributes<HTMLInputElement>): ReactElement {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      control={(tied) => <input type="text" className={CONTROL} {...input} {...tied} />}
    />
  );
}

/**
 * A text field of several lines.
 *
 * @param props - The label, an optional hint and error, and the text area's attributes.
 * @returns The labelled field.
 */
export function TextAreaField({
  label,
  hint,
  error,
  ...textarea
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      control={(tied) => (
        <textarea rows={4} className={`${CONTROL} min-h-24 resize-y py-2`} {...textarea} {...tied} />
      )}
    />
  );
}

/**
 * A choice from a list.
 *
 * @param props - The label, an optional hint and error, the choices and the select's attributes.
 * @returns The labelled select.
 */
export function SelectField({
  label,
  hint,
  error,
  options,
  ...select
}: FieldProps & {
  readonly options: readonly { readonly value: string; readonly label: string }[];
} & SelectHTMLAttributes<HTMLSelectElement>): ReactElement {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      control={(tied) => (
        <select className={`${CONTROL} select-chevron`} {...select} {...tied}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    />
  );
}
