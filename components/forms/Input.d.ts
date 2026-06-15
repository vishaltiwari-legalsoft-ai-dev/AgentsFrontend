import * as React from 'react';

/**
 * Text input with optional label, leading icon, hint, and error state.
 * @startingPoint section="Forms" subtitle="Text field with label, icon, hint & error states" viewport="700x220"
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Field label rendered above the input. */
  label?: string;
  /** Helper text below the input. */
  hint?: string;
  /** Error message — turns the field red and replaces the hint. */
  error?: string;
  /** Leading icon node (e.g. a Lucide <svg>). */
  icon?: React.ReactNode;
}

export function Input(props: InputProps): JSX.Element;
