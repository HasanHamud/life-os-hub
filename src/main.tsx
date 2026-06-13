import { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: "monospace", background: "#161210", color: "#e8e0d8", minHeight: "100vh" }}>
          <h1 style={{ color: "#e05c4a" }}>App crashed</h1>
          <pre style={{ marginTop: 16, whiteSpace: "pre-wrap", fontSize: 13 }}>{this.state.error.message}</pre>
          <pre style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById("root");
if (!root) {
  document.body.innerHTML = '<div style="padding:40px;color:red">#root element not found</div>';
} else {
  try {
    createRoot(root).render(
      <StrictMode>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (e) {
    root.innerHTML = `<pre style="padding:40px;color:red">${e instanceof Error ? e.message : String(e)}</pre>`;
  }
}
