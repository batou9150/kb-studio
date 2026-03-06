import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  onClose: () => void;
  icon?: React.ReactNode;
  title: string;
  footer?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ onClose, icon, title, footer, width, children }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={width ? { width } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            {icon}
            <span>{title}</span>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>

        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
