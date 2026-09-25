import React, { useEffect, useState } from 'react';
import { X, Terminal, CheckCircle2, AlertCircle, RefreshCw, Cpu, Database, Activity } from 'lucide-react';
import { DebugLog, JobInfo } from '../types';

interface DebugPanelProps {
  job: JobInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ job, isOpen, onClose }) => {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = () => {
    if (!job?.id) return;
    setIsLoading(true);
    fetch(`/api/jobs/${job.id}/debug`)
      .then(res => res.json())
      .then(data => {
        if (data.logs) setLogs(data.logs);
      })
      .catch(err => console.error('Failed fetching debug logs', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isOpen && job?.id) {
      fetchLogs();
      const interval = setInterval(fetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, job?.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] bg-neutral-900 text-neutral-100 shadow-2xl border-l border-neutral-800 flex flex-col animate-slide-left">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-mono font-semibold tracking-tight text-white">
            Developer / Pipeline Inspector
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pipeline Status Summary */}
      <div className="p-4 border-b border-neutral-800 grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="p-2 rounded bg-neutral-950 border border-neutral-800 space-y-1">
          <span className="text-[10px] text-neutral-400 block uppercase">Job ID</span>
          <span className="text-neutral-200 truncate block">{job?.id ? job.id.slice(0, 13) + '...' : 'None'}</span>
        </div>

        <div className="p-2 rounded bg-neutral-950 border border-neutral-800 space-y-1">
          <span className="text-[10px] text-neutral-400 block uppercase">Separation Method</span>
          <span className="text-emerald-400 font-semibold truncate block">
            {job?.separationMethod || 'DSP Inversion Filter'}
          </span>
        </div>

        <div className="p-2 rounded bg-neutral-950 border border-neutral-800 space-y-1">
          <span className="text-[10px] text-neutral-400 block uppercase">Pipeline Status</span>
          <span className="text-indigo-400 font-semibold truncate block">
            {job?.status || 'idle'} ({job?.progress || 0}%)
          </span>
        </div>

        <div className="p-2 rounded bg-neutral-950 border border-neutral-800 space-y-1">
          <span className="text-[10px] text-neutral-400 block uppercase">Media Duration</span>
          <span className="text-neutral-200 truncate block">
            {job?.duration ? `${job.duration.toFixed(1)}s` : 'Unknown'}
          </span>
        </div>
      </div>

      {/* Logs View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
        <div className="text-[11px] text-neutral-500 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Execution Telemetry & Logs ({logs.length})</span>
          <span className="text-emerald-400">Live SSE stream</span>
        </div>

        {logs.length === 0 ? (
          <div className="py-12 text-center text-neutral-500">
            No logs captured yet. Start an analysis or upload a file.
          </div>
        ) : (
          logs.map((log) => {
            let parsedData: any = null;
            if (log.data_json) {
              try { parsedData = JSON.parse(log.data_json); } catch {}
            }

            return (
              <div
                key={log.id}
                className="p-3 rounded-lg bg-neutral-950/70 border border-neutral-800/80 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10px] text-neutral-500">
                  <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-indigo-400">
                    {log.stage}
                  </span>
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>

                <p className="text-neutral-300 leading-relaxed">
                  {log.message}
                </p>

                {parsedData && (
                  <pre className="p-2 rounded bg-neutral-900 text-[10px] text-neutral-400 overflow-x-auto border border-neutral-800">
                    {JSON.stringify(parsedData, null, 2)}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-950 text-[11px] text-neutral-500 flex items-center justify-between">
        <span>MusicFinder AI Engine v1.0</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
            alert('Debug telemetry copied to clipboard');
          }}
          className="text-neutral-400 hover:text-white underline"
        >
          Copy Logs JSON
        </button>
      </div>
    </div>
  );
};
