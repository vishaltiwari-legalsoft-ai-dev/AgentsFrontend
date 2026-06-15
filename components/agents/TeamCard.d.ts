import * as React from 'react';

export interface TeamMember {
  name: string;
  category?: 'design' | 'seo' | 'copy' | 'social' | 'ads' | 'data';
}

/**
 * Brand signature card for an AI Team — a workflow assembled from agents.
 * Shows member avatars, run status, and a deploy/open action.
 * @startingPoint section="Agents" subtitle="AI Team card with member avatars, status & deploy action" viewport="700x260"
 */
export interface TeamCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Team name, e.g. "Campaign Manager". */
  name: string;
  /** Short description of what the team does. */
  description?: string;
  /** Member agents (drives the avatar cluster). */
  members?: TeamMember[];
  /** Current run status. @default "idle" */
  status?: 'idle' | 'running' | 'success' | 'error' | 'paused';
  /** Human last-run string, e.g. "2h ago". */
  lastRun?: string;
  /** Toggles action label between "Deploy team" / "Open team". */
  deployed?: boolean;
  /** Click handler for the action. Omit to hide the button. */
  onDeploy?: (e: React.MouseEvent) => void;
  /** Hover-raise affordance. @default false */
  interactive?: boolean;
}

export function TeamCard(props: TeamCardProps): JSX.Element;
