import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Isolates a section of the page from render-time crashes in its children.
 * React unmounts the whole tree up to the nearest boundary on an uncaught
 * error — without one anywhere in the app, one bad component (e.g. a
 * visualization fed unexpected data) blanks the entire page instead of
 * just its own section. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Section crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="py-8 text-center text-sm text-muted">
            This section couldn't be displayed.
          </div>
        )
      );
    }
    return this.props.children;
  }
}
