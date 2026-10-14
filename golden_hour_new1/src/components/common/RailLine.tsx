import React from 'react';
import { WESTERN_LINE_STATIONS } from '../../data/stations';

const LANDMARKS = ['churchgate', 'dadar', 'bandra', 'andheri', 'borivali', 'virar'];

interface RailLineProps {
  accent?: string;
  activeStationId?: string;
  labels?: boolean;
  className?: string;
}

/** The Western Line, Churchgate to Virar, drawn as a strip of stations. */
export const RailLine: React.FC<RailLineProps> = ({ accent = '#f8b424', activeStationId, labels = false, className = '' }) => {
  const last = WESTERN_LINE_STATIONS.length - 1;
  return (
    <div className={`gh-rail ${className}`} style={{ '--rail': accent } as React.CSSProperties} aria-hidden="true">
      <div className="gh-rail-track">
        {WESTERN_LINE_STATIONS.map((s, i) => {
          const name = s.name.replace(' Station', '');
          const landmark = LANDMARKS.includes(s.id);
          return (
            <span
              key={s.id}
              title={name}
              className={`gh-rail-stop ${landmark ? 'is-landmark' : ''} ${s.id === activeStationId ? 'is-active' : ''}`}
              style={{ left: `${(i / last) * 100}%` }}
            >
              {labels && landmark && <em>{name}</em>}
            </span>
          );
        })}
      </div>
    </div>
  );
};
