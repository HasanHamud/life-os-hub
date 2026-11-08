export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  createdAt?: number;
  avatar?: string | null;
};

type AuthState = {
  user: AuthUser | null;
  view: { id: string; name: string } | null;
};

let state: AuthState = { user: null, view: null };
const listeners = new Set<() => void>();
const PENDING_VIEW = "life-os-pending-view";

declare global {
  interface Window {
    __lifeOsSignedIn?: boolean;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeAuth(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function authState() {
  return state;
}

export function viewUserId() {
  return state.view?.id || null;
}

export function markSignedIn(on: boolean) {
  window.__lifeOsSignedIn = on;
}

export function queueWorkspaceView(view: { id: string; name: string }) {
  sessionStorage.setItem(PENDING_VIEW, JSON.stringify(view));
}

export function setAuthUser(user: AuthUser | null) {
  let view: AuthState["view"] = null;
  if (user?.role === "admin") {
    const raw = sessionStorage.getItem(PENDING_VIEW);
    if (raw) {
      sessionStorage.removeItem(PENDING_VIEW);
      try {
        const parsed = JSON.parse(raw) as { id?: string; name?: string };
        if (parsed.id && parsed.name && parsed.id !== user.id) view = { id: parsed.id, name: parsed.name };
      } catch {
        view = null;
      }
    }
  }
  state = { user, view };
  emit();
}

export function setWorkspaceView(view: { id: string; name: string } | null) {
  state = { ...state, view };
  emit();
}

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function fetchAuth(): Promise<{ needsSetup: boolean; user: AuthUser | null }> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  return readJson(res);
}

export async function submitAuth(path: string, body: { name?: string; email: string; password: string }) {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  setAuthUser(data.user);
  markSignedIn(true);
  return data.user as AuthUser;
}

export async function updateProfile(body: {
  name: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
}) {
  const res = await fetch("/api/auth/profile", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  state = { ...state, user: data.user };
  emit();
  return data.user as AuthUser;
}

export async function setAvatar(avatar: string | null) {
  const res = await fetch("/api/auth/avatar", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ avatar }),
  });
  const data = await readJson(res);
  state = { ...state, user: data.user };
  emit();
  return data.user as AuthUser;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  markSignedIn(false);
  setAuthUser(null);
  location.reload();
}
