import * as React from 'react';

/**
 * Surface container. Compose with CardHeader / CardBody / CardFooter.
 * @startingPoint section="Layout" subtitle="Surface container with header, body & footer slots" viewport="700x240"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Hover-raise + pointer affordance for clickable cards. @default false */
  interactive?: boolean;
  /** Brand-blue selected ring. @default false */
  selected?: boolean;
  /** Remove the resting shadow. @default false */
  flat?: boolean;
  children?: React.ReactNode;
}
export function Card(props: CardProps): JSX.Element;

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Title text (rendered if no children given). */
  title?: React.ReactNode;
  /** Right-aligned action node. */
  action?: React.ReactNode;
  children?: React.ReactNode;
}
export function CardHeader(props: CardHeaderProps): JSX.Element;

export interface CardSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}
export function CardBody(props: CardSectionProps): JSX.Element;
export function CardFooter(props: CardSectionProps): JSX.Element;
