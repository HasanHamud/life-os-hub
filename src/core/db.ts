import { viewUserId } from "@/core/session";

async function send(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const view = viewUserId();
  if (view) headers["X-Life-Os-User"] = view;
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && window.__lifeOsSignedIn) {
    window.__lifeOsSignedIn = false;
    location.reload();
  }
  return res;
}

async function request(method: string, path: string, body?: unknown) {
  const res = await send(method, path, body);
  if (res.status === 204) return undefined;
  const text = await res.text();
  let data: { error?: string } | undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) throw new Error(data?.error || res.statusText || "Request failed");
  return data;
}

function storePath(store: string, id?: string) {
  const base = `/api/${encodeURIComponent(store)}`;
  return id === undefined ? base : `${base}/${encodeURIComponent(id)}`;
}

export async function getAll<T>(store: string): Promise<T[]> {
  return (await request("GET", storePath(store))) as T[];
}

export async function getOne<T>(store: string, id: string): Promise<T | undefined> {
  const res = await send("GET", storePath(store, id));
  if (res.status === 404) return undefined;
  const text = await res.text();
  let data: { error?: string } | undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) throw new Error(data?.error || res.statusText || "Request failed");
  return data as T;
}

export async function putOne<T extends { id: string }>(store: string, value: T): Promise<T> {
  return (await request("PUT", storePath(store), value)) as T;
}

export async function delOne(store: string, id: string): Promise<void> {
  await request("DELETE", storePath(store, id));
}

export async function clearAll(): Promise<void> {
  await request("POST", "/api/clear");
}

export async function clearStore(store: string): Promise<void> {
  await request("POST", `${storePath(store)}/clear`);
}

export async function exportAll() {
  return await request("GET", "/api/export");
}

export async function importAll(data: unknown) {
  await request("POST", "/api/import", data);
}

export async function getConfig(key: string): Promise<string | null> {
  const data = (await request("GET", `/api/config/${encodeURIComponent(key)}`)) as { value: string | null };
  return data?.value ?? null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await request("PUT", `/api/config/${encodeURIComponent(key)}`, { value });
}

export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));
