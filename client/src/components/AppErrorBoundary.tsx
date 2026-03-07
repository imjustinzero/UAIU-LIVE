import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "Unexpected application error",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[AppErrorBoundary]", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main
          id="main"
          className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6"
          role="alert"
        >
          <div className="max-w-lg w-full rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4">
            <h1 className="text-xl font-semibold">We hit an unexpected error</h1>
            <p className="text-sm text-slate-300">
              The app encountered an issue and may not have loaded correctly. You can safely refresh to retry.
            </p>
            <p className="text-xs text-amber-300 break-all">
              Error: {this.state.errorMessage}
            </p>
            <Button onClick={this.handleReload}>Reload app</Button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
