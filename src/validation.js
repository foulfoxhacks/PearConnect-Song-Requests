// Shared input rules for HTTP and direct chat adapters.
export class InputError extends Error {
  constructor(message) { super(message); this.name = 'InputError'; }
}

export function text(value, name, { max = 512, optional = false } = {}) {
  if (value === undefined && optional) return '';
  if (typeof value !== 'string') throw new InputError(`${name} must be a string.`);
  const clean = value.trim();
  if ((!optional && !clean) || clean.length > max || /[\u0000-\u001f\u007f]/u.test(clean)) {
    throw new InputError(`${name} must contain ${optional ? '0' : '1'}-${max} characters without control characters.`);
  }
  if (/^([{%]).+([}%])$/u.test(clean)) throw new InputError(`${name} contains an unresolved placeholder.`);
  return clean;
}

export function validatePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('Body must be a JSON object.');
  const user = text(body.user, 'user', { max: 100 }).replace(/^@/, '');
  if (!user) throw new InputError('user must not be empty.');
  const userId = text(body.userId, 'userId', { max: 100, optional: true });
  // Empty song queries are intentional: the queue manager returns usage help.
  const query = text(body.query, 'query', { optional: true });
  return { user, userId, query };
}
