/**
 * Buttons.
 *
 * @packageDocumentation
 */
import type { ButtonHTMLAttributes, ReactElement } from "react";

/**
 * How a button looks: `primary` for the one filled action on a screen, `secondary` for the rest, `quiet` for actions
 * inside rows, and `problem` for one that removes something.
 */
export type ButtonVariant = "primary" | "secondary" | "quiet" | "problem";

/** How big a button is: `md` at the density's control height, `sm` inside rows and notices. */
export type ButtonSize = "md" | "sm";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-primary text-primary-ink hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--ink))]",
  secondary: "border-line-strong bg-surface text-ink hover:bg-panel",
  quiet: "border-transparent bg-transparent text-ink hover:bg-panel-2 aria-pressed:bg-active",
  problem: "border-problem-edge bg-transparent text-problem hover:bg-problem-wash",
};

const SIZES: Record<ButtonSize, string> = {
  md: "min-h-(--control) px-[calc(var(--control)*0.4)] text-body",
  sm: "min-h-7 px-2.5 text-meta",
};

/**
 * The classes that style a control as a button, for links that act like one.
 *
 * @param variant - How it looks.
 * @param size - How big it is.
 * @returns The class names.
 */
export function buttonClassName(variant: ButtonVariant, size: ButtonSize = "md"): string {
  return `inline-flex items-center justify-center gap-(--space-2) rounded-md border leading-none font-semibold whitespace-nowrap no-underline transition-[background-color,border-color,transform] duration-(--dur-feedback) ease-(--ease) active:translate-y-px disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-line disabled:bg-panel disabled:text-ink-3 ${SIZES[size]} ${VARIANTS[variant]}`;
}

/**
 * A button that names what happens.
 *
 * @param props - The button's attributes, how it looks and how big it is; it is `type="button"` unless set.
 * @returns The styled button.
 */
export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}): ReactElement {
  return <button type={type} className={`${buttonClassName(variant, size)} ${className}`} {...props} />;
}
