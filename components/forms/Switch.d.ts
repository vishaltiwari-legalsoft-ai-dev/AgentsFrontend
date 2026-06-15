import * as React from 'react';

/** Toggle switch for on/off settings. Brand-blue when on. */
export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Text label rendered after the switch. */
  label?: string;
}

export function Switch(props: SwitchProps): JSX.Element;
