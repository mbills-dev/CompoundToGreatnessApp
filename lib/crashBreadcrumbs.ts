import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'debug_breadcrumbs';
const MAX_ENTRIES = 20;

export interface BreadcrumbEntry {
  step: string;
  meta?: Record<string, unknown>;
  timestamp: number;
}

export async function logBreadcrumb(step: string, meta?: Record<string, unknown>): Promise<void> {
  try {
    const entry: BreadcrumbEntry = { step, meta, timestamp: Date.now() };
    const existing = await AsyncStorage.getItem(KEY);
    const arr: BreadcrumbEntry[] = existing ? JSON.parse(existing) : [];
    arr.push(entry);
    await AsyncStorage.setItem(KEY, JSON.stringify(arr.slice(-MAX_ENTRIES)));
  } catch {}
}

export async function getBreadcrumbs(): Promise<BreadcrumbEntry[]> {
  try {
    const existing = await AsyncStorage.getItem(KEY);
    return existing ? JSON.parse(existing) : [];
  } catch {
    return [];
  }
}

export async function clearBreadcrumbs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
