import assert from 'assert';
import { applyCacheMutation } from '../src/offline/client.js';
const baseState = [
    { id: 1, name: 'Alpha' },
    { id: 2, name: 'Beta' },
];
// Insert should prepend and dedupe
const inserted = applyCacheMutation(baseState, { type: 'insert', record: { id: 3, name: 'Gamma' } });
assert.ok(inserted && inserted.length === 3, 'Insert should add new record');
assert.strictEqual(inserted?.[0].id, 3, 'Newest insert should be first');
const dedupedInsert = applyCacheMutation(inserted, { type: 'insert', record: { id: 1, name: 'Alpha v2' } });
assert.ok(dedupedInsert && dedupedInsert.filter((i) => i.id === 1).length === 1, 'Insert should dedupe by id');
assert.strictEqual(dedupedInsert?.[0].name, 'Alpha v2', 'Latest insert version should win');
// Update should merge and preserve others
const updated = applyCacheMutation(dedupedInsert, { type: 'update', record: { id: 2, name: 'Beta Updated' } });
assert.ok(updated && updated.find((i) => i.id === 2)?.name === 'Beta Updated', 'Update should merge payload');
// Update should add missing items if not found
const upserted = applyCacheMutation(updated, { type: 'update', record: { id: 4, name: 'Delta' } });
assert.ok(upserted && upserted.some((i) => i.id === 4), 'Update should upsert when id not found');
// Delete should remove matching id (from match)
const deleted = applyCacheMutation(upserted, { type: 'delete', match: { id: 1 } });
assert.ok(deleted && !deleted.some((i) => i.id === 1), 'Delete should remove item by id');
console.log('cacheInvalidation tests passed');
