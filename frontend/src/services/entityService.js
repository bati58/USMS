import { api } from './apiClient'

// Factory that produces a CRUD service bound to one collection.
// Every module service (stores, categories, items, ...) is created from
// this so the calling pages share one consistent async contract.
export function createEntityService(collection) {
  return {
    list: () => api.list(collection),
    get: (id) => api.get(collection, id),
    create: (record) => api.create(collection, record),
    update: (id, patch) => api.update(collection, id, patch),
    remove: (id) => api.remove(collection, id)
  }
}
