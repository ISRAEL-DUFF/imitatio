import { Dexie, type EntityTable } from 'dexie';
import type { Entry, Generation, Passage, Setting } from '@/types';

// Schema from docs/SPEC.md §6.3. The `*` prefix makes tags, constructionKeys
// and deviceKeys multi-entry indexes, so "every pattern with a genitive
// absolute" is a direct index lookup.
export class ImitatioDB extends Dexie {
  passages!: EntityTable<Passage, 'id'>;
  entries!: EntityTable<Entry, 'id'>;
  generations!: EntityTable<Generation, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'imitatio') {
    super(name);
    this.version(1).stores({
      passages: 'id, language, source.author, createdAt',
      entries:
        'id, passageId, language, level, *tags, *constructionKeys, *deviceKeys, createdAt, updatedAt',
      generations: 'id, entryId, createdAt',
      settings: 'key',
    });
  }
}

export const db = new ImitatioDB();
