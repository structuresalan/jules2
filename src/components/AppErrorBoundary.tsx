import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message,
    };
  }

  componentDidCatch(error: Error) {
    console.error('App crashed', error);
  }

  handleReset = () => {
    try {
      window.localStorage.removeItem('struccalc.projects.v1');
      window.localStorage.removeItem('struccalc.activeProjectId.v1');
      window.localStorage.removeItem('struccalc.sessionMode.v1');
    } catch {
      // ignore storage reset failures
    }

    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-gray-50 p-8 text-gray-900">
        <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-red-700">Something went wrong loading StrucCalc</h1>
          <p className="mt-3 text-sm text-gray-600">
            The app hit a frontend error instead of showing a blank page. Resetting saved browser project data usually fixes this.
          </p>

          {this.state.message && (
            <pre className="mt-4 overflow-auto rounded bg-gray-900 p-4 text-xs text-white">{this.state.message}</pre>
          )}

          <button
            onClick={this.handleReset}
            className="mt-5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Reset Saved Project Data
          </button>
        </div>
      </div>
    );
  }
}
