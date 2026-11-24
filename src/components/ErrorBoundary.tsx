import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Catches render errors anywhere below it and shows a recovery screen instead of a blank page. */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#080B12] px-6 text-center">
        <p className="text-lg font-medium text-foreground">something went wrong</p>
        <p className="text-sm text-muted-foreground">try reloading — if it keeps happening, let us know</p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
          >
            reload
          </button>
          <button
            onClick={() => (window.location.href = "/feed")}
            className="rounded-full border border-border px-5 py-2 text-sm text-foreground"
          >
            go to feed
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
