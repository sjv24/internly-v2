import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

/**
 * Error boundary: if any component below throws while rendering, show a friendly fallback instead
 * of a blank white page. (Error boundaries must be class components - React has no hook for this.)
 */
interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In a real product this is where you would send the error to a tracking service.
    console.error("UI crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto my-20 max-w-lg rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <h1 className="text-xl font-semibold text-red-800">This page crashed</h1>
        <p className="mt-2 text-sm text-red-700">An unexpected error happened while displaying this page.</p>
        <button type="button" className="btn-primary mt-5" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
        <a href="/" className="btn-secondary ml-3 mt-5">
          Go home
        </a>
      </div>
    );
  }
}
