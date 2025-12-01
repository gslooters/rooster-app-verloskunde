// ToggleSwitch: Simple toggle switch component voor regel activatie
// DRAAD95F: Vereenvoudigde Planregels UI - Toggle-Only Interface
'use client';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export default function ToggleSwitch({ 
  checked, 
  onChange, 
  disabled = false 
}: ToggleSwitchProps) {
  return (
    <label className="toggle-switch">
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={onChange}
        disabled={disabled}
      />
      <span className="slider" />
      
      <style jsx>{`
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 24px;
          flex-shrink: 0;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #d1d5db;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 24px;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        input:checked + .slider {
          background-color: #10b981;
        }

        input:checked + .slider:before {
          transform: translateX(24px);
        }

        input:disabled + .slider {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        input:not(:disabled) + .slider:hover {
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }
        
        input:not(:disabled):checked + .slider:hover {
          background-color: #059669;
        }
      `}</style>
    </label>
  );
}
