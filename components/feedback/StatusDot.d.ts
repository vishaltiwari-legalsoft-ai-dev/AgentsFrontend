import * as React from 'react';

/** Status indicator dot with label. `running` pulses with a brand-blue ping. */
export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** @default "idle" */
  status?: 'idle' | 'running' | 'success' | 'error' | 'paused';
  /** Override the default label text. */
  label?: string;
  /** Hide the text label, show only the dot. @default true */
  showLabel?: boolean;
}

export function StatusDot(props: StatusDotProps): JSX.Element;
