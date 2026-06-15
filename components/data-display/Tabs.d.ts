import * as React from 'react';

export interface TabItem {
  value: string;
  label: string;
  /** Optional leading icon node. */
  icon?: React.ReactNode;
  /** Optional trailing count. */
  count?: number;
}

/** Controlled tab strip. `pill` (segmented) or `line` (underline) variants. */
export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Tabs as strings or {value,label,icon,count}. */
  items: Array<string | TabItem>;
  /** Currently selected value. */
  value: string;
  /** Called with the new value on tab click. */
  onChange?: (value: string) => void;
  /** @default "pill" */
  variant?: 'pill' | 'line';
}

export function Tabs(props: TabsProps): JSX.Element;
