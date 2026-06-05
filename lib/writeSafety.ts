export function errorMessage(error: any, fallback = 'Something went wrong. Your changes were not saved.'): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.error_description) return error.error_description;
  return fallback;
}

export function throwIfError(result: { error?: any }, fallback?: string) {
  if (result.error) throw new Error(errorMessage(result.error, fallback));
}

/**
 * Heuristic: did this error come from a dropped/absent network connection
 * rather than a real server-side failure? Supabase surfaces fetch failures as
 * a TypeError ("Network request failed" / "Failed to fetch"), so we can show a
 * calmer "You're offline" message and a Retry instead of a scary error.
 */
export function isOfflineError(error: any): boolean {
  const msg = (typeof error === 'string' ? error : error?.message || '').toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('load failed')
  );
}
