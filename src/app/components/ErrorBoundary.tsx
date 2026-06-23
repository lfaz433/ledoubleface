import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

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
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0704] text-[#E5D5C5] flex flex-col items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-[#120D09] border border-[#C8102E]/30 rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-[#C8102E]/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-8 h-8 text-[#C8102E]" />
            </div>
            <h1 className="text-2xl font-bold text-white font-serif">Something went wrong</h1>
            <p className="text-sm text-[#8E7E70] break-words">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => window.location.href = "/"}
              className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-[#D4A017] text-black font-bold rounded-xl hover:bg-[#D4A017]/90 transition-colors"
            >
              <RefreshCw size={16} />
              Return to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
