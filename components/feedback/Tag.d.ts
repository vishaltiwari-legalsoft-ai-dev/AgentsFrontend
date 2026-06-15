import * as React from 'react';

/**
 * Rounded category tag, color-coded to an agent specialism. Pass `glyph`
 * for a leading icon and `onRemove` to render a removable × .
 */
export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Agent-category color. Omit for neutral gray. */
  category?: 'design' | 'seo' | 'copy' | 'social' | 'ads' | 'data';
  /** Leading glyph node (e.g. a Lucide <svg>). */
  glyph?: React.ReactNode;
  /** When provided, renders a removable × that calls this on click. */
  onRemove?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
}

export function Tag(props: TagProps): JSX.Element;
