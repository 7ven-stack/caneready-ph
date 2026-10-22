import React from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[CaneReadyPH ErrorBoundary]', error, errorInfo);
  }

  handleReloadData = () => {
    try {
      localStorage.removeItem('caneready_lots_v1');
    } catch {}
    this.setState({ hasError: false, error: null });
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  handleHardReset = () => {
    try {
      localStorage.removeItem('caneready_lots_v1');
      localStorage.removeItem('caneready_pending_ops_v1');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Display Error Encountered
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  CaneReadyPH hit an unexpected runtime or cached data issue.
                </p>
              </div>
            </div>

            {this.state.error?.message && (
              <pre className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono text-rose-700 dark:text-rose-300 overflow-x-auto">
                {this.state.error.message}
              </pre>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleHardReset}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Cache & Reset</span>
              </button>
              <button
                type="button"
                onClick={this.handleReloadData}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reload data</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
