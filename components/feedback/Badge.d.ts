import * as React from 'react';

/** Small status/label pill. Use `dot` for a leading status dot. */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** @default "neutral" */
  variant?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'outline';
  /** Show a leading dot in the current color. @default false */
  dot?: boolean;
  /** Optional leading icon node. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function Badge(props: BadgeProps): JSX.Element;
