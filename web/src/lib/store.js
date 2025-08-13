import { set, get, del, keys, createStore } from 'idb-keyval'

const store = createStore('ebl-db', 'packs')
const MAX_SAVED = 10

function newId() {
  try { return crypto.randomUUID() } catch { /* older browsers */ }
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// Internal: load all entries (full) from DB
async function _allEntries() {
  const ks = await keys(store)
  const entries = await Promise.all(ks.map(k => get(k, store)))
  // Filter out null/undefined and malformed
  return entries.filter(Boolean)
}

// Keep at most MAX_SAVED newest entries
async function _enforceLimit() {
  const entries = await _allEntries()
  if (entries.length <= MAX_SAVED) return
  // sort by createdAt ASC, remove oldest extras
  entries.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  const toDelete = entries.slice(0, entries.length - MAX_SAVED)
  await Promise.all(toDelete.map(e => del(e.id, store)))
}

// Public: save a pack with metadata; returns saved id
export async function savePack(pack, { title, lang, input }) {
  const entry = {
    id: newId(),
    title: String(title || 'Lite Pack'),
    lang: lang || 'en',
    input: String(input || ''),
    pack,
    createdAt: Date.now()
  }
  await set(entry.id, entry, store)
  await _enforceLimit()
  return entry.id
}

// Public: list saved packs (meta only), newest first
export async function listPacks() {
  const entries = await _allEntries()
  entries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return entries.map(e => ({
    id: e.id,
    title: e.title,
    lang: e.lang,
    createdAt: e.createdAt
  }))
}

// Public: load full entry by id
export async function loadPack(id) {
  return get(id, store)
}

// Public: delete by id
export async function deletePack(id) {
  await del(id, store)
}

// Public: clear all (not used in UI, but handy)
export async function clearAll() {
  const list = await listPacks()
  await Promise.all(list.map(e => del(e.id, store)))
}
