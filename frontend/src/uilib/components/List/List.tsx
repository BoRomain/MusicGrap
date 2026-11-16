import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../utils';
import './List.css';

export interface ListProps extends HTMLAttributes<HTMLDivElement> {
  /** Draw the list as a bordered panel. Default true. */
  inset?: boolean;
}

export function List({ inset = true, className, ...rest }: ListProps) {
  return <div role="list" className={cx('ui-list', inset && 'ui-list--inset', className)} {...rest} />;
}

export interface ListItemProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Icon, avatar or image on the left. */
  leading?: ReactNode;
  /** Badge, value, Switch… on the right. */
  trailing?: ReactNode;
  /** Show a ">" on the right (navigation). */
  chevron?: boolean;
  /** Makes the row a button. */
  onClick?: () => void;
  disabled?: boolean;
}

export function ListItem({ title, subtitle, leading, trailing, chevron, onClick, disabled, className, ...rest }: ListItemProps) {
  const content = (
    <>
      {leading && <span className="ui-list-item__leading">{leading}</span>}
      <span className="ui-list-item__text">
        <span className="ui-list-item__title">{title}</span>
        {subtitle && <span className="ui-list-item__subtitle">{subtitle}</span>}
      </span>
      {trailing && <span className="ui-list-item__trailing">{trailing}</span>}
      {chevron && (
        <svg className="ui-list-item__chevron" viewBox="0 0 24 24" aria-hidden>
          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </>
  );
  const cls = cx('ui-list-item', onClick && 'ui-list-item--action ui-focusable', className);
  return (
    <div role="listitem" className="ui-list__row">
      {onClick ? (
        <button type="button" className={cls} onClick={onClick} disabled={disabled} {...rest}>
          {content}
        </button>
      ) : (
        <div className={cls} {...rest}>
          {content}
        </div>
      )}
    </div>
  );
}
