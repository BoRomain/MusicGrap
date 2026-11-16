import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../../utils';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** Full width. */
  block?: boolean;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Icon before the label. */
  icon?: ReactNode;
  /** Icon after the label. */
  iconEnd?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block, loading, icon, iconEnd, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx('ui-btn ui-focusable', `ui-btn--${variant}`, `ui-btn--${size}`, block && 'ui-btn--block', className)}
      {...rest}
    >
      {loading ? <span className="ui-spinner" aria-hidden /> : icon && <span className="ui-btn__icon">{icon}</span>}
      {children != null && <span className="ui-btn__label">{children}</span>}
      {iconEnd && <span className="ui-btn__icon">{iconEnd}</span>}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'iconEnd' | 'block'> {
  'aria-label': string;
}

/** Square button that holds only an icon. `aria-label` is required. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', className, ...rest },
  ref,
) {
  return <Button ref={ref} variant={variant} className={cx('ui-btn--icon-only', className)} {...rest} />;
});
