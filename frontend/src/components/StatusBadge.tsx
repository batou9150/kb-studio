import React from 'react';

type StatusVariant = 'primary' | 'success' | 'danger' | 'warning';

const colorMap: Record<StatusVariant, string> = {
  primary: 'var(--primary-color)',
  success: 'var(--success-color)',
  danger: 'var(--danger-color)',
  warning: 'var(--warning-color)',
};

interface StatusBadgeProps {
  variant: StatusVariant;
  icon: React.ReactNode;
  children: React.ReactNode;
  title?: string;
  bold?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ variant, icon, children, title, bold = false }) => {
  return (
    <span
      className="status-badge"
      style={{ color: colorMap[variant], fontWeight: bold ? 500 : undefined }}
      title={title}
    >
      {icon}
      {children}
    </span>
  );
};
