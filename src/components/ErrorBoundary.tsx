import { Component, type ReactNode } from 'react';

/** Catches render errors in a subtree (e.g. the map) so the rest of the page keeps working. */
export class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    // Log locally only; never send user data to third-party error services.
    console.error('[as3ari] render error', error instanceof Error ? error.message : error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
