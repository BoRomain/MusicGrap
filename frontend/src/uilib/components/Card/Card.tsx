import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../utils';
import './Card.css';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  /** Element shown at the right of the title (e.g. a Switch). */
  action?: ReactNode;
}

function CardBase({ title, action, className, children, ...rest }: CardProps) {
  return (
    <section className={cx('ui-card', className)} {...rest}>
      {(title || action) && (
        <header className="ui-card__header">
          {title && <h3 className="ui-card__title">{title}</h3>}
          {action && <div className="ui-card__action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export interface CardRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
}

/** Label on the left, control on the right. */
export function CardRow({ title, description, className, children, ...rest }: CardRowProps) {
  return (
    <div className={cx('ui-card-row', className)} {...rest}>
      <div className="ui-card-row__text">
        <div className="ui-card-row__title">{title}</div>
        {description && <div className="ui-card-row__desc">{description}</div>}
      </div>
      {children && <div className="ui-card-row__control">{children}</div>}
    </div>
  );
}

export const Card = Object.assign(CardBase, { Row: CardRow });
