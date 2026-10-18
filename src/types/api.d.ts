interface DbApi {
  getAll<T>(store: string): Promise<T[]>;
  getOne<T>(store: string, id: string): Promise<T | undefined>;
  putOne<T>(store: string, value: T): Promise<T>;
  delOne(store: string, id: string): Promise<void>;
  clearAll(): Promise<void>;
  exportAll(): Promise<any>;
  importAll(data: any): Promise<void>;
}

interface PinApi {
  getHash(): Promise<string | null>;
  setHash(hash: string): Promise<void>;
  verify(pin: string): Promise<boolean>;
  set(pin: string): Promise<boolean>;
  exists(): Promise<boolean>;
}

interface Window {
  api: {
    db: DbApi;
    pin: PinApi;
    onBridgeChanged?: (callback: () => void) => () => void;
  };
}
