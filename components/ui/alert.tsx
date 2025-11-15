import * as React from 'react';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
  children: React.ReactNode;
}

interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-blue-50 border-blue-200 text-blue-800',
      destructive: 'bg-red-50 border-red-200 text-red-800',
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={`rounded-lg border p-4 ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

const AlertDescription = React.forwardRef<HTMLParagraphElement, AlertDescriptionProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={`text-sm ${className}`}
        {...props}
      >
        {children}
      </p>
    );
  }
);

AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertDescription };
