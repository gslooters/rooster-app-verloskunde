import React from 'react';

export default function ServiceCell({ code, color, description }: { code: string; color: string; description?: string }) {
  return (
    <div className="flex items-center gap-2" title={description || ''}>
      <div 
        className="w-4 h-4 rounded-sm border"
        style={{ backgroundColor: color }}
      />
      <div className="font-medium tracking-wide" style={{letterSpacing:'0.02em'}}>
        {code}
      </div>
    </div>
  );
}
