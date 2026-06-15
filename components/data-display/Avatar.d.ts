import * as React from 'react';

/** Circular (or square) avatar showing an image or initials from `name`. */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Full name — used for initials fallback and tooltip. */
  name?: string;
  /** Image URL. Falls back to initials when absent. */
  src?: string;
  /** @default "md" */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Square (rounded-rect) instead of circle. @default false */
  square?: boolean;
  /** Solid background color (for initials avatars). */
  color?: string;
  children?: React.ReactNode;
}

export function Avatar(props: AvatarProps): JSX.Element;

/** Overlapping cluster of avatars. */
export interface AvatarGroupProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
}

export function AvatarGroup(props: AvatarGroupProps): JSX.Element;
