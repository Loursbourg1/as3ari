import { Component, type ReactNode } from 'react';

/** Catches render errors in a subtree (e.g. the map) so the rest of the page keeps working. */
export class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: unknown, _info: unknown) {
    // Error is captured by getDerivedStateFromError above; no logging needed.
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
