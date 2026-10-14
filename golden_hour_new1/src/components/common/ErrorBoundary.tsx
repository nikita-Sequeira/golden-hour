import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled UI exception in ErrorBoundary:', error, errorInfo);
  }

  public handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 sm:p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Emergency Interface Recovery</h2>
              <p className="text-xs text-slate-500 mt-1">
                An unexpected display issue occurred. Your hospital reservation session is saved in the database.
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 bg-slate-100 rounded-xl text-left font-mono text-[11px] text-slate-700 overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>
              <div className="pt-2">
                <a
                  href="tel:108"
                  className="inline-block text-xs font-bold text-rose-600 hover:underline"
                >
                  Call 108 Emergency Ambulance Immediately
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
