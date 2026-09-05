export async function sessionApi(path, body = {}) {
  const response = await fetch(`/api/session/${path}`, { method: 'POST', credentials: 'same-origin', redirect: 'error', signal: AbortSignal.timeout(12000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The session service is unavailable. Check your connection and try the status check again.');
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.message || 'The session service could not complete this action.'); error.code = data.code; throw error; }
  return data;
}
export const displayTime = time => new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
