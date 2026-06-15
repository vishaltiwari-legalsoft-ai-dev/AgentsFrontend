import * as React from 'react';

/**
 * Square icon-only button for toolbars and dense actions. Always pass `label`
 * for accessibility (used as aria-label + tooltip title).
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label / tooltip. Required. */
  label: string;
  /** @default "ghost" */
  variant?: 'ghost' | 'solid' | 'brand';
  /** @default "md" */
  size?: 'sm' | 'md' | 'lg';
  /** Icon node (e.g. a Lucide <svg>). */
  children?: React.ReactNode;
}

export function IconButton(props: IconButtonProps): JSX.Element;
