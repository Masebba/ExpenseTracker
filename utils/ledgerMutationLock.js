// Serializes user-visible ledger mutations in memory before they reach storage.
// Storage writes have their own queue, but coordinating the state calculation and
// commit prevents a Trade sale from overwriting an income/expense added mid-save.
const queues = new Map();

export const withLocalLedgerMutationLock = async (ownerId, operation) => {
  if (typeof operation !== 'function') throw new TypeError('A ledger operation is required.');
  const key = String(ownerId || 'guest');
  const previous = queues.get(key) || Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  queues.set(key, current);
  try {
    return await current;
  } finally {
    if (queues.get(key) === current) queues.delete(key);
  }
};
