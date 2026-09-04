/**
 * Callback data contract.
 *
 * Callback payloads only ever carry an action name and opaque database
 * identifiers. Prices, rewards, amounts and permission flags are always
 * re-read from the database — never trusted from the payload.
 */
export const CB = {
  menu: 'menu',
  learn: 'learn',
  quests: 'quest',
  bonus: 'bonus',
  progress: 'prog',
  shop: 'shop',
  achievements: 'ach',
  profile: 'prof',
  settings: 'set',
  rewards: 'rw',
  admin: 'adm',
  noop: 'noop',
} as const;

export function cb(namespace: string, ...parts: Array<string | number>): string {
  const data = [namespace, ...parts].join(':');
  if (data.length > 64) {
    throw new Error(`Callback data too long (${data.length} > 64): ${data}`);
  }
  return data;
}

export function parseCallback(data: string): { namespace: string; action: string; args: string[] } {
  const [namespace = '', action = '', ...args] = data.split(':');
  return { namespace, action, args };
}
