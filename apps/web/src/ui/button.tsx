/**
 * Buttons.
 *
 * @packageDocumentation
 */
import type { ButtonHTMLAttributes, ReactElement } from "react";

/** How a button looks: `primary` for the one main action on a screen, `secondary` for the rest. */
export type ButtonVariant = "primary" | "secondary" | "quiet";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground border-transparent hover:opacity-90",
  secondary: "bg-surface text-ink border-line-strong hover:bg-panel",
  quiet: "bg-transparent text-ink-2 border-transparent hover:bg-panel hover:text-ink",
};

/**
 * The classes that style a control as a button, for links that act like one.
 *
 * @param variant - How it looks.
 * @returns The class names.
 */
export function buttonClassName(variant: ButtonVariant): string {
  return `inline-flex min-h-(--control) items-center justify-center gap-(--space-2) rounded-md border px-[calc(var(--control)*0.4)] font-semibold no-underline transition-colors duration-(--dur-feedback) disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]}`;
}

/**
 * A button that names what happens.
 *
 * @param props - The button's attributes, and how it looks; it is `type="button"` unless set.
 * @returns The styled button.
 */
export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { readonly variant?: ButtonVariant }): ReactElement {
  return <button type={type} className={`${buttonClassName(variant)} ${className}`} {...props} />;
}
