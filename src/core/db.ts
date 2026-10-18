function getApi() {
  if (typeof window !== "undefined" && (window as any).api) {
    return (window as any).api.db;
  }
  return null;
}

export async function getAll<T>(store: string): Promise<T[]> {
  const api = getApi();
  if (!api) return [];
  return (await api.getAll(store)) as T[];
}

export async function getOne<T>(store: string, id: string): Promise<T | undefined> {
  const api = getApi();
  if (!api) return undefined;
  return (await api.getOne(store, id)) as T | undefined;
}

export async function putOne<T extends { id: string }>(store: string, value: T): Promise<T> {
  const api = getApi();
  if (!api) throw new Error("Database not available");
  return (await api.putOne(store, value)) as T;
}

export async function delOne(store: string, id: string): Promise<void> {
  const api = getApi();
  if (!api) return;
  await api.delOne(store, id);
}

export async function clearAll(): Promise<void> {
  const api = getApi();
  if (!api) return;
  await api.clearAll();
}

export async function clearStore(store: string): Promise<void> {
  const api = getApi();
  if (!api) return;
  await api.clearStore(store);
}

export async function exportAll() {
  const api = getApi();
  if (!api) return {};
  return await api.exportAll();
}

export async function importAll(data: any) {
  const api = getApi();
  if (!api) throw new Error("Database not available");
  await api.importAll(data);
}

export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));
