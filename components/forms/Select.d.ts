import * as React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Native select styled to match the system, with a custom chevron.
 * Pass `options` (strings or {value,label}) or your own <option> children.
 */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Field label rendered above the control. */
  label?: string;
  /** Options as plain strings or {value,label} objects. */
  options?: Array<string | SelectOption>;
}

export function Select(props: SelectProps): JSX.Element;
