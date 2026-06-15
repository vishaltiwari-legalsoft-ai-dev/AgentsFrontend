import * as React from 'react';

/**
 * Brand signature card for a single specialist AI agent: category glyph tile,
 * name, role, description, category tag, optional status and add-to-team action.
 * @startingPoint section="Agents" subtitle="Specialist agent card with category glyph, tag & action" viewport="700x220"
 */
export interface AgentCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Agent display name, e.g. "Graphic Designer". */
  name: string;
  /** Short role line, e.g. "Brand & visual assets". */
  role?: string;
  /** One- or two-line description. */
  description?: string;
  /** Specialism — drives the glyph tile and tag color. @default "design" */
  category?: 'design' | 'seo' | 'copy' | 'social' | 'ads' | 'data';
  /** Glyph node for the tile (e.g. a Lucide <svg>). */
  glyph?: React.ReactNode;
  /** Optional run status shown in the footer. */
  status?: 'idle' | 'running' | 'success' | 'error' | 'paused';
  /** Toggles the action button label between "Add to team" / "Added". */
  added?: boolean;
  /** Click handler for the add button. Omit to hide the button. */
  onAdd?: (e: React.MouseEvent) => void;
  /** Hover-raise affordance. @default false */
  interactive?: boolean;
}

export function AgentCard(props: AgentCardProps): JSX.Element;
