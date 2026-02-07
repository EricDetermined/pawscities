import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, iconPosition = 'left', ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative">
          {iconPosition === 'left' && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
          <input type={type} className={cn('flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50', iconPosition === 'left' && 'pl-10', iconPosition === 'right' && 'pr-10', className)} ref={ref} {...props} />
          {iconPosition === 'right' && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
        </div>
      );
    }
    return <input type={type} className={cn('flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50', className)} ref={ref} {...props} />;
  }
);
Input.displayName = 'Input';

export { Input };
