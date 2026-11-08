import { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { getOne } from "./core/db";
import { applyTheme, DEFAULT_THEME, rememberedTheme } from "./core/theme";
import { applyLocale, rememberedLocale } from "./core/locale";
import "./styles.css";

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
        <div style={{ padding: 40, fontFamily: "monospace", background: "var(--background)", color: "var(--foreground)", minHeight: "100vh" }}>
          <h1 style={{ color: "var(--destructive)" }}>App crashed</h1>
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
  void bootstrap(root);
}

async function bootstrap(container: HTMLElement) {
  try {
    const settings = await getOne<{ theme?: unknown; locale?: unknown }>("settings", "global");
    applyTheme(settings?.theme ?? rememberedTheme() ?? DEFAULT_THEME);
    await applyLocale(settings?.locale ?? rememberedLocale());
  } catch {
    applyTheme(rememberedTheme() ?? DEFAULT_THEME);
    await applyLocale(rememberedLocale());
  }

  try {
    createRoot(container).render(
      <StrictMode>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (e) {
    container.innerHTML = `<pre style="padding:40px;color:var(--destructive)">${e instanceof Error ? e.message : String(e)}</pre>`;
  }
}
