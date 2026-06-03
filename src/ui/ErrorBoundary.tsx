import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  title: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    // Avoid logging UI errors because exception payloads may include API responses.
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="fallback-shell" role="alert">
          <h1>{this.props.title}</h1>
          <p>画面の表示中にエラーが発生しました。拡張機能を再読み込みしてから再試行してください。</p>
        </main>
      );
    }

    return this.props.children;
  }
}
