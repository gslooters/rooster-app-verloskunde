import * as React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'success';
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium transition-colors';
    
    const variants = {
      default: 'bg-purple-100 text-purple-800 border border-purple-300',
      secondary: 'bg-gray-100 text-gray-800 border border-gray-300',
      destructive: 'bg-red-100 text-red-800 border border-red-300',
      success: 'bg-green-100 text-green-800 border border-green-300',
    };

    const classes = `${baseStyles} ${variants[variant]} ${className}`;

    return (
      <div
        className={classes}
        ref={ref}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
