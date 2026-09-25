import React from 'react';
import { Check, Loader2, Circle, FileAudio, FileVideo, Clock, HardDrive } from 'lucide-react';
import { JobInfo } from '../types';

interface ProgressPipelineProps {
  job: JobInfo;
  waveformPoints?: number[];
}

export const ProgressPipeline: React.FC<ProgressPipelineProps> = ({ job, waveformPoints = [] }) => {
  const steps = [
    { id: 'extracting', label: 'Audio extracted', stageOrder: 1 },
    { id: 'separating', label: 'Vocals separated', stageOrder: 2 },
    { id: 'analyzing', label: 'Music being analyzed', stageOrder: 3 },
    { id: 'identifying', label: 'Identifying song(s)', stageOrder: 4 },
    { id: 'discovering', label: 'Finding available source', stageOrder: 5 },
  ];

  // Determine current stage index based on job.status and progress
  const getStageStatus = (stageOrder: number) => {
    let currentStageIndex = 1;
    if (job.status === 'extracting') currentStageIndex = 1;
    else if (job.status === 'separating') currentStageIndex = 2;
    else if (job.status === 'analyzing') currentStageIndex = 3;
    else if (job.status === 'identifying') currentStageIndex = 4;
    else if (job.status === 'discovering') currentStageIndex = 5;
    else if (job.status === 'completed') currentStageIndex = 6;

    if (currentStageIndex > stageOrder) return 'completed';
    if (currentStageIndex === stageOrder) return 'active';
    return 'pending';
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isVideo = job.filename.toLowerCase().match(/\.(mp4|mov|mkv|webm)$/);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 py-4 animate-fade-in">
      {/* File Overview Card */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              {isVideo ? <FileVideo className="w-5 h-5" /> : <FileAudio className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                {job.filename}
              </h3>
              <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(job.duration)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {formatFileSize(job.size)}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40">
              {job.progress}%
            </span>
          </div>
        </div>

        {/* Real-time Waveform Bars */}
        {waveformPoints.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between gap-[2px] h-10 px-2 py-1 bg-neutral-100/70 dark:bg-neutral-900/60 rounded-xl overflow-hidden border border-neutral-200/50 dark:border-neutral-800/50">
              {waveformPoints.slice(0, 64).map((pt, i) => {
                const heightPercent = Math.max(12, Math.round(pt * 100));
                const isPassed = (i / 64) * 100 <= job.progress;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-all duration-300 ${
                      isPassed
                        ? 'bg-indigo-500 dark:bg-indigo-400'
                        : 'bg-neutral-300 dark:bg-neutral-700/60'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Global Progress Line */}
        <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-500 ease-out"
            style={{ width: `${Math.max(5, job.progress)}%` }}
          />
        </div>
      </div>

      {/* 5-Step Pipeline Card */}
      <div className="p-6 rounded-2xl glass-panel shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-200/60 dark:border-neutral-800/60 pb-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-500 dark:text-neutral-400">
            Processing Pipeline
          </h2>
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
            {job.currentStep || 'Initializing...'}
          </span>
        </div>

        <div className="space-y-3 pt-1">
          {steps.map((step, idx) => {
            const status = getStageStatus(step.stageOrder);
            return (
              <div
                key={step.id}
                className="flex items-center gap-3.5 text-sm transition-colors duration-200"
              >
                {/* Status Indicator Icon */}
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                  {status === 'completed' && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                    </div>
                  )}
                  {status === 'active' && (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                      <Loader2 className="w-3 h-3 animate-spin stroke-[2.5]" />
                    </div>
                  )}
                  {status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border border-neutral-300 dark:border-neutral-700 text-neutral-300 dark:text-neutral-600 flex items-center justify-center">
                      <Circle className="w-2.5 h-2.5 fill-current opacity-40" />
                    </div>
                  )}
                </div>

                {/* Step Text */}
                <div className="flex-1 flex items-center justify-between">
                  <span
                    className={`font-medium ${
                      status === 'completed'
                        ? 'text-neutral-900 dark:text-neutral-200'
                        : status === 'active'
                        ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'text-neutral-400 dark:text-neutral-500'
                    }`}
                  >
                    {idx + 1}. {step.label}
                  </span>

                  {status === 'active' && (
                    <span className="text-[11px] font-medium text-indigo-500 animate-pulse">
                      In progress...
                    </span>
                  )}
                  {status === 'completed' && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      Completed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
