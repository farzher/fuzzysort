declare const typeBrand: unique symbol
declare const targetTypeBrand: unique symbol

export interface Result {
  /** Match score: 1 is exact, 0.5 is good, and 0 is no match */
  readonly score: number

  /** Original target string */
  readonly target: string

  highlight(highlightOpen?: string, highlightClose?: string, threshold?: number): string
  highlight<T>(callback: HighlightCallback<T>): (string | T)[]

  /** Matched character indexes */
  indexes: ReadonlyArray<number>
}
export interface Results<T = Result> extends ReadonlyArray<T> {
  /** Number of matches before applying `limit` */
  readonly total: number
}

export interface KeyResult<T> extends Result {
  /** Original target object */
  readonly obj: T
}
export interface KeyResults<T> extends Results<KeyResult<T>> {}

export interface KeysResult<T> extends ReadonlyArray<Result> {
  /** Combined match score: 1 is exact, 0.5 is good, and 0 is no match */
  readonly score: number

  /** Original target object */
  readonly obj: T
}
export interface KeysResults<T> extends Results<KeysResult<T>> {}

/** A target returned by `fuzzysort.prepare()` */
export interface Prepared {
  readonly [typeBrand]: 'target'
  /** Original target string */
  readonly target: string
}
export type Target = string | Prepared

/** An immutable snapshot of string targets */
export interface Snapshot {
  readonly [typeBrand]: 'strings'
}
/** An immutable snapshot of objects searchable by one key */
export interface SnapshotKey<T> {
  readonly [typeBrand]: 'key'
  readonly [targetTypeBrand]?: T
}
/** An immutable snapshot of objects searchable by multiple keys */
export interface SnapshotKeys<T> {
  readonly [typeBrand]: 'keys'
  readonly [targetTypeBrand]?: T
}

export interface Options<R = Result> {
  /** Max results; defaults to 10; 0 = unlimited */
  limit?: number

  /** Minimum score; defaults to .5; 0 = any match */
  threshold?: number

  /** Override result scoring */
  scoreFn?: (result: R) => number
}
/** A property path, path segments, or getter */
export type Key<T> = string | ReadonlyArray<string> | ((obj: T) => Target | null | undefined)
export interface SnapshotKeyOptions<T> {
  /** Key to search */
  key: Key<T>
  keys?: never
}
export interface SnapshotKeysOptions<T> {
  /** Keys to search */
  keys: ReadonlyArray<Key<T>>
  key?: never
}
export interface KeyOptions<T> extends Options<KeyResult<T>>, SnapshotKeyOptions<T> {}
export interface KeysOptions<T> extends Options<KeysResult<T>>, SnapshotKeysOptions<T> {}

export type HighlightCallback<T> = (match: string, index: number) => T

export interface Fuzzysort {
  single(search: string, target: Target): Result | null

  go(search: string, targets: ReadonlyArray<Target> | Snapshot, options?: Options): Results
  go<T>(search: string, targets: ReadonlyArray<T>, options: KeyOptions<T>): KeyResults<T>
  go<T>(search: string, targets: ReadonlyArray<T>, options: KeysOptions<T>): KeysResults<T>
  go<T>(search: string, targets: SnapshotKey<T>, options?: Options<KeyResult<T>>): KeyResults<T>
  go<T>(search: string, targets: SnapshotKeys<T>, options?: Options<KeysResult<T>>): KeysResults<T>

  /** Prepare one target for fast searching */
  prepare(target: Target): Prepared

  /** Create an immutable snapshot for the best search performance; use when targets don't change */
  snapshot(targets: ReadonlyArray<Target>): Snapshot
  snapshot<T>(targets: ReadonlyArray<T>, options: SnapshotKeyOptions<T>): SnapshotKey<T>
  snapshot<T>(targets: ReadonlyArray<T>, options: SnapshotKeysOptions<T>): SnapshotKeys<T>

  /** Highlight a result, including a structured clone */
  highlight(result: Result, highlightOpen?: string, highlightClose?: string, threshold?: number): string
  highlight<T>(result: Result, callback: HighlightCallback<T>): (string | T)[]

  /** Read a result's score, including from a structured clone */
  score(result: Result | KeysResult<unknown>): number

  /** Add or override character remappings */
  remap(mappings: Readonly<Record<string, string>>): void

  /** Clear internal caches */
  cleanup(): void
}

export const single: Fuzzysort['single']
export const go: Fuzzysort['go']
export const highlight: Fuzzysort['highlight']
export const score: Fuzzysort['score']
export const remap: Fuzzysort['remap']
export const prepare: Fuzzysort['prepare']
export const snapshot: Fuzzysort['snapshot']
export const cleanup: Fuzzysort['cleanup']

declare const fuzzysort: Fuzzysort
export default fuzzysort
