import { Dimension, RefineSuggestion, TaskGroup } from './types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const BASE = `${SUPABASE_URL}/functions/v1/identity-ai`;

const headers = {
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export async function analyzeGoal(goalText: string): Promise<{ dimensions: Dimension[] }> {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ goalText }),
  });
  if (!res.ok) throw new Error('Failed to analyze goal');
  return res.json();
}

export async function getRefineSuggestion(dimension: Dimension): Promise<RefineSuggestion> {
  const res = await fetch(`${BASE}/refine`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ dimension }),
  });
  if (!res.ok) throw new Error('Failed to get refinement');
  return res.json();
}

export async function generateCompassFilterQuestion(declaration: string, vision: string): Promise<string> {
  const res = await fetch(`${BASE}/compass-filter`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ declaration, vision }),
  });
  if (!res.ok) throw new Error('Failed to generate filter question');
  const data = await res.json();
  return data.filterQuestion;
}

export async function generateTasks(dimensions: Dimension[]): Promise<{ taskGroups: TaskGroup[] }> {
  const res = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ dimensions }),
  });
  if (!res.ok) throw new Error('Failed to generate tasks');
  return res.json();
}
