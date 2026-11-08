import { useEffect, useState } from "react";

export type DirectoryPerson = { id: string; name: string };

let people: DirectoryPerson[] = [];
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function loadPeople() {
  if (!loading) {
    loading = fetch("/api/people", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        people = Array.isArray(rows) ? rows : [];
        listeners.forEach((listener) => listener());
      })
      .catch(() => {});
  }
  return loading;
}

export function usePeople() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    loadPeople();
    return () => { listeners.delete(listener); };
  }, []);
  return people;
}

export function personName(people: DirectoryPerson[], id?: string) {
  if (!id) return "";
  return people.find((person) => person.id === id)?.name ?? "";
}
