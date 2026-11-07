import { domainError, err, ok, type DomainError, type Result } from '@repo/contracts';
import { changesEntry } from './correction';
import { type Entry, type EntryDraft, type FoundEntry } from './entry';

export function retriedEntry(
  requestKey: string,
  draft: EntryDraft,
  keyed: FoundEntry,
): Result<Entry, DomainError> {
  if (keyed.reversed) {
    return err(
      domainError(
        'CONFLICT',
        `Request key "${requestKey}" posted an Entry that has since been deleted or corrected.`,
      ),
    );
  }
  if (changesEntry(draft, keyed.entry)) {
    return err(
      domainError(
        'CONFLICT',
        `Request key "${requestKey}" was already used to post an Entry with other content.`,
      ),
    );
  }
  return ok(keyed.entry);
}
