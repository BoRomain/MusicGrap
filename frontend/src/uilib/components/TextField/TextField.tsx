import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../../utils';
import './TextField.css';

export interface FieldShellProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error message. Shared by TextField and Select. */
export function FieldShell({ id, label, hint, error, className, children }: FieldShellProps) {
  return (
    <div className={cx('ui-field', error ? 'ui-field--error' : undefined, className)}>
      {label && (
        <label className="ui-field__label" htmlFor={id}>
          {label}
        </label>
      )}
      {children}
      {(error || hint) && (
        <div id={`${id}-msg`} className="ui-field__msg">
          {error || hint}
        </div>
      )}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  /** Error message. Replaces `hint` and marks the field invalid. */
  error?: ReactNode;
  /** Icon or text inside the field, on the left. */
  leading?: ReactNode;
  /** Icon, button or text inside the field, on the right. */
  trailing?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, leading, trailing, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={className}>
      <div className="ui-field__box">
        {leading && <span className="ui-field__adorn">{leading}</span>}
        <input
          ref={ref}
          id={fieldId}
          className="ui-field__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
          {...rest}
        />
        {trailing && <span className="ui-field__adorn">{trailing}</span>}
      </div>
    </FieldShell>
  );
});
