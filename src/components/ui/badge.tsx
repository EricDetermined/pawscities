import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary-100 text-primary-700 border border-primary-200',
        secondary: 'bg-secondary-100 text-secondary-700 border border-secondary-200',
        destructive: 'bg-red-100 text-red-700 border border-red-200',
        outline: 'text-foreground border border-gray-200',
        dogFriendly: 'bg-green-100 text-green-700 border border-green-200',
        premium: 'bg-amber-100 text-amber-700 border border-amber-200',
        verified: 'bg-blue-100 text-blue-700 border border-blue-200',
        category: 'bg-gray-100 text-gray-700 border border-gray-200',
        open: 'bg-green-100 text-green-700 border border-green-200',
        closed: 'bg-red-100 text-red-700 border border-red-200',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
}

function Badge({ className, variant, icon, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {icon && <span className="mr-1">{icon}</span>}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
