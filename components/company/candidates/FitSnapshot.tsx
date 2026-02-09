'use client';

import React from 'react';
import { FitSnapshot as FitSnapshotType } from '@/lib/mockCompanyData';

interface FitSnapshotProps {
  fitSnapshot: FitSnapshotType;
}

export const FitSnapshot: React.FC<FitSnapshotProps> = ({ fitSnapshot }) => {
  const { strong_fits, needs_validation } = fitSnapshot;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-400">
        Fit Snapshot
      </h3>
      <div className="grid grid-cols-2 gap-6">
        {/* Strong Fits Column */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-neutral-300">Strong Fits</h4>
          <ul className="space-y-1.5">
            {strong_fits.map((fit, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-neutral-400">
                <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
                <span>{fit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Needs Validation Column */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-neutral-300">Needs Validation</h4>
          <ul className="space-y-1.5">
            {needs_validation.map((need, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-neutral-400">
                <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                <span>{need}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
