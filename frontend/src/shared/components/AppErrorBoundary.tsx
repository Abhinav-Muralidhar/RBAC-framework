import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'The application could not render this screen.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('AppErrorBoundary caught a render error', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--page-gradient)] p-6 text-slate-900">
          <div className="max-w-lg rounded-3xl border border-rose-200 bg-white p-8 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-600">Render Failure</p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">This screen failed to load.</h1>
            <p className="mt-3 text-sm text-slate-600">
              {this.state.message || 'A render error interrupted the route change.'}
            </p>
            <button
              type="button"
              className="mt-6 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => window.location.reload()}
            >
              Reload application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
