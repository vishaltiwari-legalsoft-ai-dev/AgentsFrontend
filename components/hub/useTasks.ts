"use client";

/** Your list — the one structure in this console the reader authors.
 *
 *  Everything else on Home is the shop reporting on itself. This is not, so it
 *  persists: a list that forgets what you typed the moment you reload is not a
 *  list, it is a decoration.
 *
 *  It is kept in this browser, and the panel says so. That is a real limit — it
 *  does not follow you to another machine — and stating it is better than a
 *  silent surprise. It is deliberately not a backend collection: a personal
 *  scratch list is not agent activity, and giving it a Firestore collection
 *  would put private notes into a store the admin Database panel browses.
 *
 *  An unfinished task does not belong to the day you thought of it. It belongs
 *  to today, every day, until it is done — that is the whole job of a list.
 *  Looking back at a past day shows what was raised that day and what was
 *  crossed off that day, and nothing else.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "ah-todo";

export interface Task {
  id: string;
  text: string;
  /** ISO date (YYYY-MM-DD) the task was raised. */
  day: string;
  done: boolean;
  /** ISO date it was crossed off. Present only when `done`. */
  doneDay?: string;
}

export const todayKey = (now = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

export function shiftDay(key: string, by: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + by);
  return todayKey(dt);
}

export function daysBetween(from: string, to: string): number {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  const a = new Date(ay, (am || 1) - 1, ad || 1).getTime();
  const b = new Date(by, (bm || 1) - 1, bd || 1).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** A stored list from an older shape would file every task nowhere and read as
 *  data loss, so the shape is checked rather than assumed. */
function sane(t: unknown): t is Task {
  if (!t || typeof t !== "object") return false;
  const x = t as Record<string, unknown>;
  return typeof x.id === "string"
    && typeof x.text === "string"
    && typeof x.day === "string"
    && typeof x.done === "boolean"
    && (!x.done || typeof x.doneDay === "string");
}

function read(): Task[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (Array.isArray(raw) && raw.every(sane)) return raw as Task[];
  } catch {
    /* a corrupt or absent store just means an empty list */
  }
  return [];
}

export interface TaskList {
  tasks: Task[];
  /** What belongs on one day's page. */
  forDay: (day: string) => Task[];
  open: number;
  add: (text: string) => void;
  tick: (id: string) => void;
  lift: (id: string) => void;
  drop: (id: string) => void;
  /** False until the first read, so the panel does not flash an empty list at a
   *  reader who has one. */
  ready: boolean;
}

export function useTasks(): TaskList {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);

  // Read after mount: localStorage does not exist while the page is being
  // rendered on the server, and reading it during render would make the first
  // client paint disagree with the server's.
  useEffect(() => {
    setTasks(read());
    setReady(true);
  }, []);

  const write = useCallback((next: Task[]) => {
    setTasks(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode — the list still works for this session */
    }
  }, []);

  const add = useCallback((text: string) => {
    const clean = text.trim().slice(0, 140);
    if (!clean) return;
    write([
      { id: `t${Date.now().toString(36)}`, text: clean, day: todayKey(), done: false },
      ...read(),
    ]);
  }, [write]);

  const tick = useCallback((id: string) => {
    write(read().map((t) => (
      t.id === id
        ? t.done
          ? { id: t.id, text: t.text, day: t.day, done: false }
          : { ...t, done: true, doneDay: todayKey() }
        : t
    )));
  }, [write]);

  const lift = useCallback((id: string) => {
    const list = read();
    const i = list.findIndex((t) => t.id === id);
    if (i <= 0) return;
    const next = [...list];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    write(next);
  }, [write]);

  const drop = useCallback((id: string) => {
    write(read().filter((t) => t.id !== id));
  }, [write]);

  const forDay = useCallback((day: string) => {
    const today = todayKey();
    return day === today
      ? tasks.filter((t) => !t.done || t.doneDay === today)
      : tasks.filter((t) => t.day === day || t.doneDay === day);
  }, [tasks]);

  return {
    tasks,
    forDay,
    open: tasks.filter((t) => !t.done).length,
    add, tick, lift, drop, ready,
  };
}
