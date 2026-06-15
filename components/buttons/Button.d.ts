import * as React from 'react';

/**
 * Primary interactive control. Default `primary` is ink-black (the sleek
 * minimal action); use `brand` for the single blue highlight per view.
 *
 * @startingPoint section="Buttons" subtitle="Ink / brand / secondary / ghost / danger, 3 sizes" viewport="700x200"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. @default "primary" */
  variant?: 'primary' | 'brand' | 'gradient' | 'accent' | 'secondary' | 'ghost' | 'danger';
  /** @default "md" */
  size?: 'sm' | 'md' | 'lg';
  /** Stretch to container width. @default false */
  fullWidth?: boolean;
  /** Icon node rendered before the label (e.g. a Lucide <svg>). */
  iconLeft?: React.ReactNode;
  /** Icon node rendered after the label. */
  iconRight?: React.ReactNode;
  /** Render as a different element, e.g. "a". @default "button" */
  as?: keyof JSX.IntrinsicElements;
  children?: React.ReactNode;
}

export function Button(props: ButtonProps): JSX.Element;
