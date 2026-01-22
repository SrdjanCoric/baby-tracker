import React, { Component, ErrorInfo, ReactNode } from "react";
import type { ErrorBoundaryState, ErrorInfo as AppErrorInfo } from "@/types/error";
import { ErrorFallback } from "./ErrorFallback";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      errorInfo: {
        componentStack: errorInfo.componentStack || "",
      },
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    if (__DEV__) {
      console.error("ErrorBoundary caught an error:", error);
      console.error("Component stack:", errorInfo.componentStack);
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          resetError={this.resetError}
          errorInfo={this.state.errorInfo as AppErrorInfo}
        />
      );
    }

    return this.props.children;
  }
}
