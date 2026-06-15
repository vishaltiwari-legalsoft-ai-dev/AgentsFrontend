import * as React from 'react';

/** Checkbox (or radio, via `radio`) with brand-blue checked state. */
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Text label rendered after the control. */
  label?: string;
  /** Render as a radio button instead of a checkbox. @default false */
  radio?: boolean;
}

export function Checkbox(props: CheckboxProps): JSX.Element;
