declare namespace Fuzzysort {

  const preparedBrand: unique symbol

  interface Result {
    /**
    * 1 is a perfect match. 0.5 is a good match. 0 is no match. 
    */
    readonly score: number

    /** Your original target string */
    readonly target: string

    highlight(highlightOpen?: string, highlightClose?: string): string
    highlight<T>(callback: HighlightCallback<T>): (string | T)[]

    indexes: ReadonlyArray<number>
  }
  interface Results extends ReadonlyArray<Result> {
    /** Total matches before limit */
    readonly total: number
  }

  interface KeyResult<T> extends Result {
    /** Your original object */
    readonly obj: T
  }
  interface KeyResults<T> extends ReadonlyArray<KeyResult<T>> {
    /** Total matches before limit */
    readonly total: number
  }

  interface KeysResult<T> extends ReadonlyArray<Result> {
    /**
    * 1 is a perfect match. 0.5 is a good match. 0 is no match. 
    */
    readonly score: number

    /** Your original object */
    readonly obj: T
  }
  interface KeysResults<T> extends ReadonlyArray<KeysResult<T>> {
    /** Total matches before limit */
    readonly total: number
  }


  /** A prepared target string returned by fuzzysort.prepare(target). */
  interface PreparedTarget {
    readonly [preparedBrand]: 'target'
    /** Your original target string */
    readonly target: string
  }
  /** An immutable optimized snapshot of string targets. */
  interface Snapshot {
    readonly [preparedBrand]: 'strings'
  }
  /** An immutable optimized snapshot of object targets searchable by one key. */
  interface SnapshotKey<T> {
    readonly [preparedBrand]: 'key'
    readonly _targetType?: T
  }
  /** An immutable optimized snapshot of object targets searchable by multiple keys. */
  interface SnapshotKeys<T> {
    readonly [preparedBrand]: 'keys'
    readonly _targetType?: T
  }

  interface Options<R = Result> {
    /** Don't return matches worse than this (higher is faster) */
    threshold?: number

    /** Don't return more results than this (lower is faster) */
    limit?: number

    /** If true, returns all results for an empty search */
    all?: boolean

    /** Override a match's score, or return 0 to exclude it */
    scoreFn?: (result: R) => number
  }
  type Key<T> = string | ((obj: T) => string | PreparedTarget) | ReadonlyArray<string>
  interface SnapshotKeyOptions<T> {
    key: Key<T>
  }
  interface SnapshotKeysOptions<T> {
    keys: ReadonlyArray<Key<T>>
  }
  interface KeyOptions<T> extends Options<KeyResult<T>>, SnapshotKeyOptions<T> {}
  interface KeysOptions<T> extends Options<KeysResult<T>>, SnapshotKeysOptions<T> {}

  interface HighlightCallback<T> { (match: string, index: number): T }

  interface Fuzzysort {

    single(search: string, target: string | PreparedTarget): Result | null

    go(search: string, targets: ReadonlyArray<string | PreparedTarget> | Snapshot, options?: Options): Results
    go<T>(search: string, targets: ReadonlyArray<T>, options: KeyOptions<T>): KeyResults<T>
    go<T>(search: string, targets: ReadonlyArray<T>, options: KeysOptions<T>): KeysResults<T>
    go<T>(search: string, targets: SnapshotKey<T>, options?: Options<KeyResult<T>>): KeyResults<T>
    go<T>(search: string, targets: SnapshotKeys<T>, options?: Options<KeysResult<T>>): KeysResults<T>

    /** Prepare one target for use in a mutable target collection. */
    prepare(target: string): PreparedTarget

    /** Build an immutable optimized snapshot for repeated searches. */
    snapshot(targets: ReadonlyArray<string>): Snapshot
    snapshot<T>(targets: ReadonlyArray<T>, options: SnapshotKeyOptions<T>): SnapshotKey<T>
    snapshot<T>(targets: ReadonlyArray<T>, options: SnapshotKeysOptions<T>): SnapshotKeys<T>

    /** Highlight a result, including one received through structuredClone or postMessage */
    highlight(result: Result, highlightOpen?: string, highlightClose?: string): string
    highlight<T>(result: Result, callback: HighlightCallback<T>): (string | T)[]

    /** Read the normalized score of a result received through structuredClone or postMessage */
    score(result: Result | KeysResult<unknown>): number

    /** Add or override character remappings. */
    remap(mappings: Readonly<Record<string, string>>): void

    /**
    * Free memory caches if you're done using fuzzysort for now
    */
    cleanup(): void
  }
}

declare const fuzzysort: Fuzzysort.Fuzzysort
export default fuzzysort
