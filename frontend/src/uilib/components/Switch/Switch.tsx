import type { ButtonHTMLAttributes } from 'react';
import { useControllable } from '../../hooks/useControllable';
import { cx } from '../../utils';
import './Switch.css';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}

export function Switch({ checked, defaultChecked = false, onChange, className, disabled, ...rest }: SwitchProps) {
  const [on, setOn] = useControllable(checked, defaultChecked, onChange);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={cx('ui-switch ui-focusable', on && 'ui-switch--on', className)}
      onClick={() => setOn(!on)}
      {...rest}
    >
      <span className="ui-switch__thumb" />
    </button>
  );
}
