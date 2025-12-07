'use client';

import React from 'react';
import { RosterAssignmentRecord } from '@/lib/types/solver';

interface RosterCellProps {
  record: RosterAssignmentRecord;
  serviceMap?: Map<string, { code: string; naam: string }>;
  onEdit?: (record: RosterAssignmentRecord) => void;
}

/**
 * DRAAD125: FASE 5 - UI Components met Hulpvelden
 * 
 * RosterCell toont een assignment in roosterweergave met:
 * 1. Source badge (Manual/ORT/System/Import)
 * 2. Is_Protected lock icon (🔒/🔓)
 * 3. Confidence color coding (🟢/🟡/🔴)
 * 4. Constraint reason tooltip
 * 5. Diff visualization (previous_service_id)
 */

export function RosterCell({ record, serviceMap, onEdit }: RosterCellProps) {
  // Feature 1: Source Badge
  const getSourceBadge = () => {
    const badges = {
      manual: { icon: '🔵', label: 'Manual', class: 'source-manual' },
      ort: { icon: '🤖', label: 'ORT', class: 'source-ort' },
      system: { icon: '⚙️', label: 'System', class: 'source-system' },
      import: { icon: '📥', label: 'Import', class: 'source-import' }
    };
    const source = (record.source || 'manual') as keyof typeof badges;
    const badge = badges[source] || badges.manual;
    return <span className={`source-badge ${badge.class}`}>{badge.icon} {badge.label}</span>;
  };

  // Feature 2: Is_Protected Lock Icon
  const getLockIcon = () => {
    if (record.is_protected) {
      const tooltip = [
        `Status: ${record.status}`,
        `Beschermd: ${record.status === 1 ? 'Handmatig' : 'Geblokkeerd'}`,
        `Kan niet wijzigen`
      ].join('\n');
      return (
        <span className="lock-icon" title={tooltip}>
          🔒
        </span>
      );
    }
    return <span className="lock-icon">🔓</span>;
  };

  // Feature 3: Confidence Color Coding
  const getConfidenceColor = () => {
    const confidence = record.ort_confidence;
    if (confidence === null || confidence === undefined) {
      return '#cccccc'; // Gray - niet van ORT
    }
    if (confidence > 0.8) {
      return '#4caf50'; // Groen - Hoog vertrouwen
    }
    if (confidence >= 0.5) {
      return '#ff9800'; // Oranje - Middelmatig
    }
    return '#f44336'; // Rood - Laag vertrouwen
  };

  const getConfidenceLabel = () => {
    const confidence = record.ort_confidence;
    if (confidence === null || confidence === undefined) {
      return '';
    }
    const percentage = (confidence * 100).toFixed(0);
    if (confidence > 0.8) return `${percentage}% (High)`;
    if (confidence >= 0.5) return `${percentage}% (Medium)`;
    return `${percentage}% (Low)`;
  };

  // Feature 4: Constraint Reason Tooltip
  const buildConstraintTooltip = () => {
    const reason = record.constraint_reason;
    if (!reason || !reason.constraints) return null;

    const lines = [
      '📌 WHY ORT CHOSE THIS:',
      `Constraints: ${reason.constraints.join(', ')}`,
      `Reason: ${reason.reason_text}`,
      `Flexibility: ${reason.flexibility}`,
      `Can modify: ${reason.can_modify ? 'Yes' : 'No'}`
    ];

    if (reason.suggest_modification) {
      lines.push(`Suggestion: ${reason.suggest_modification}`);
    }

    return lines.join('\n');
  };

  // Feature 5: Diff Visualization (previous_service_id)
  const getDiffInfo = () => {
    if (!record.previous_service_id && serviceMap) {
      return null;
    }
    if (record.previous_service_id) {
      const oldService = serviceMap?.get(record.previous_service_id);
      const newService = serviceMap?.get(record.service_id || '');
      return {
        badge: `Was ${oldService?.code || 'Unknown'}, now ${newService?.code || 'Unknown'}`,
        highlight: true
      };
    }
    return null;
  };

  const diff = getDiffInfo();
  const cellStyle = {
    borderLeft: `4px solid ${getConfidenceColor()}`,
    backgroundColor: diff?.highlight ? '#fff9c4' : record.is_protected ? '#f5f5f5' : '#ffffff',
    opacity: record.is_protected ? 0.7 : 1,
    cursor: record.is_protected ? 'not-allowed' : 'pointer',
    pointerEvents: record.is_protected ? 'none' : 'auto'
  } as React.CSSProperties;

  const serviceName = serviceMap?.get(record.service_id || '')?.code || record.service_id || '—';

  return (
    <div
      className="roster-cell"
      style={cellStyle}
      title={buildConstraintTooltip() || undefined}
      onClick={() => !record.is_protected && onEdit?.(record)}
    >
      <div className="cell-content">
        {/* Source Badge */}
        {record.source && record.source !== 'manual' && (
          <div className="cell-badge">
            {getSourceBadge()}
          </div>
        )}

        {/* Lock Icon */}
        <div className="cell-lock">
          {getLockIcon()}
        </div>

        {/* Service Name */}
        <div className="cell-service">
          {serviceName}
        </div>

        {/* Confidence Info */}
        {record.ort_confidence !== null && record.ort_confidence !== undefined && (
          <div className="cell-confidence" title={`Confidence: ${getConfidenceLabel()}`}>
            {getConfidenceLabel()}
          </div>
        )}

        {/* Diff Badge */}
        {diff && (
          <div className="cell-diff" title={diff.badge}>
            🔄 {diff.badge}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Styles for RosterCell
 * Add to your CSS module or global styles
 */
const cellStyles = `
.roster-cell {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  transition: all 150ms ease-out;
  border: 1px solid #e0e0e0;
}

.roster-cell:hover:not([style*="pointer-events: none"]) {
  background-color: #f9f9f9;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.cell-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cell-badge {
  margin-bottom: 2px;
}

.source-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  margin-right: 4px;
  width: fit-content;
}

.source-manual { background: #e3f2fd; color: #1976d2; }   /* Blauw */
.source-ort    { background: #f3e5f5; color: #7b1fa2; }   /* Paars */
.source-system { background: #f1f8e9; color: #558b2f; }   /* Groen */
.source-import { background: #fff3e0; color: #e65100; }   /* Oranje */

.lock-icon {
  font-size: 14px;
  margin-right: 4px;
}

.cell-service {
  font-weight: 600;
  color: #333;
}

.cell-confidence {
  font-size: 10px;
  color: #666;
  margin-top: 2px;
}

.cell-diff {
  font-size: 9px;
  color: #ff9800;
  font-weight: 500;
  margin-top: 2px;
  background: #fff3e0;
  padding: 1px 4px;
  border-radius: 3px;
  width: fit-content;
}

.cell-protected {
  background-color: #f5f5f5;
  opacity: 0.7;
  pointer-events: none;
}

.cell-editable {
  background-color: #ffffff;
  cursor: pointer;
}

.confidence-high    { border-left-color: #4caf50; }  /* 🟢 */
.confidence-medium  { border-left-color: #ff9800; }  /* 🟡 */
.confidence-low     { border-left-color: #f44336; }  /* 🔴 */
.confidence-none    { border-left-color: #cccccc; }  /* ⚪ */
`;

export default RosterCell;