import React from 'react';
import {
  X, RefreshCw, WifiOff, Wifi, AlertTriangle, CheckCircle2, Trash2, Clock
} from 'lucide-react';
import { OutboxSyncState } from '../lib/offlineSyncEngine';
import { useLanguage } from '../lib/i18n';

interface SyncOutboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  syncState: OutboxSyncState;
  onRunSync: () => Promise<void>;
  onDismissConflict: (conflictId: string) => Promise<void>;
  onClearAllConflicts: () => Promise<void>;
}

export const SyncOutboxModal: React.FC<SyncOutboxModalProps> = ({
  isOpen,
  onClose,
  isOnline,
  syncState,
  onRunSync,
  onDismissConflict,
  onClearAllConflicts,
}) => {
  const { language } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isOnline
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
              }`}
            >
              {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                {language === 'dv'
                  ? 'އޮފްލައިން އައުޓްބޮކްސް & ސިންކް ކޮންފްލިކްޓް'
                  : 'Offline Outbox & Sync Conflict Resolution'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {isOnline
                  ? 'Connected — queued IndexedDB mutations replay in FIFO order with idempotency guards.'
                  : 'Offline — circulation actions are queued safely in IndexedDB until connectivity resumes.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Pending Outbox Queue */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Pending Outbox Queue ({syncState.pendingEntries.length})</span>
              </h4>
              {isOnline && syncState.pendingEntries.length > 0 && (
                <button
                  type="button"
                  onClick={() => void onRunSync()}
                  disabled={syncState.isSyncing}
                  className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
                  <span>{syncState.isSyncing ? 'Syncing...' : 'Sync All Now'}</span>
                </button>
              )}
            </div>

            {syncState.pendingEntries.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>No pending offline operations in IndexedDB outbox.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {syncState.pendingEntries.map((entry) => (
                  <div
                    key={entry.outbox_id}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-xs space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold uppercase text-emerald-700 dark:text-emerald-400">
                          {entry.action}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {entry.endpoint}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                        {new Date(entry.client_timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate">
                      Key: <bdi>{entry.idempotency_key}</bdi> · Attempts: {entry.attempts}
                    </div>
                    {entry.last_error && (
                      <div className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold">
                        Last notice: {entry.last_error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sync Conflicts */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Reconciled Sync Conflicts ({syncState.conflicts.length})</span>
              </h4>
              {syncState.conflicts.length > 0 && (
                <button
                  type="button"
                  onClick={() => void onClearAllConflicts()}
                  className="text-xs font-bold text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {syncState.conflicts.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                No conflicting server-vs-offline transactions detected.
              </div>
            ) : (
              <div className="space-y-2.5">
                {syncState.conflicts.map((conflict) => (
                  <div
                    key={conflict.conflict_id}
                    className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 text-xs space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-extrabold text-rose-900 dark:text-rose-200 uppercase font-mono">
                        {conflict.action} · {conflict.conflict_type}
                      </div>
                      <button
                        type="button"
                        onClick={() => void onDismissConflict(conflict.conflict_id)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                      >
                        Acknowledge & Dismiss
                      </button>
                    </div>
                    <p className="text-slate-700 dark:text-slate-200 font-medium">
                      {conflict.server_reason}
                    </p>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 font-mono">
                      <span>Resolution: {conflict.resolution_strategy}</span>
                      <span>{new Date(conflict.detected_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono tabular-nums">
            {syncState.lastSyncedAt
              ? `Last synced: ${new Date(syncState.lastSyncedAt).toLocaleTimeString()}`
              : 'Ready'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
