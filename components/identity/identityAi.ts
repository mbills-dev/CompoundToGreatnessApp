import { supabase } from '@/lib/supabase';

export async function generateIdentityStatements(
  goals: string[],
): Promise<(string | null)[] | null> {
  try {
    const invokePromise = supabase.functions.invoke('generate-identity', {
      body: { goals },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 2500),
    );

    const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

    if (error) return null;
    if (!data || !Array.isArray(data.statements)) return null;

    return data.statements as (string | null)[];
  } catch {
    return null;
  }
}
