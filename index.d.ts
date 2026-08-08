declare namespace Fuzzysort {

  const typeBrand: unique symbol
  const targetTypeBrand: unique symbol

  interface Result {
    /** Match score: 1 is exact, 0.5 is good, and 0 is no match */
    readonly score: number

    /** Original target string */
    readonly target: string

    highlight(highlightOpen?: string, highlightClose?: string, threshold?: number): string
    highlight<T>(callback: HighlightCallback<T>): (string | T)[]

    /** Matched character indexes */
    indexes: ReadonlyArray<number>
  }
  interface Results<T = Result> extends ReadonlyArray<T> {
    /** Number of matches before applying `limit` */
    readonly total: number
  }

  interface KeyResult<T> extends Result {
    /** Original target object */
    readonly obj: T
  }
  interface KeyResults<T> extends Results<KeyResult<T>> {}

  interface KeysResult<T> extends ReadonlyArray<Result> {
    /** Combined match score: 1 is exact, 0.5 is good, and 0 is no match */
    readonly score: number

    /** Original target object */
    readonly obj: T
  }
  interface KeysResults<T> extends Results<KeysResult<T>> {}

  /** A target returned by `fuzzysort.prepare()` */
  interface PreparedTarget {
    readonly [typeBrand]: 'target'
    /** Original target string */
    readonly target: string
  }
  type Target = string | PreparedTarget

  /** An immutable snapshot of string targets */
  interface Snapshot {
    readonly [typeBrand]: 'strings'
  }
  /** An immutable snapshot of objects searchable by one key */
  interface SnapshotKey<T> {
    readonly [typeBrand]: 'key'
    readonly [targetTypeBrand]?: T
  }
  /** An immutable snapshot of objects searchable by multiple keys */
  interface SnapshotKeys<T> {
    readonly [typeBrand]: 'keys'
    readonly [targetTypeBrand]?: T
  }

  interface Options<R = Result> {
    /** Max results; 0 = unlimited */
    limit?: number

    /** Minimum score; 0 = any match */
    threshold?: number

    /** Return all targets when search is empty */
    all?: boolean

    /** Override result scoring */
    scoreFn?: (result: R) => number
  }
  /** A property path, path segments, or getter */
  type Key<T> = string | ReadonlyArray<string> | ((obj: T) => Target | null | undefined)
  interface SnapshotKeyOptions<T> {
    /** Key to search */
    key: Key<T>
  }
  interface SnapshotKeysOptions<T> {
    /** Keys to search */
    keys: ReadonlyArray<Key<T>>
  }
  interface KeyOptions<T> extends Options<KeyResult<T>>, SnapshotKeyOptions<T> {}
  interface KeysOptions<T> extends Options<KeysResult<T>>, SnapshotKeysOptions<T> {}

  type HighlightCallback<T> = (match: string, index: number) => T

  interface Fuzzysort {
    single(search: string, target: Target): Result | null

    go(search: string, targets: ReadonlyArray<Target> | Snapshot, options?: Options): Results
    go<T>(search: string, targets: ReadonlyArray<T>, options: KeyOptions<T>): KeyResults<T>
    go<T>(search: string, targets: ReadonlyArray<T>, options: KeysOptions<T>): KeysResults<T>
    go<T>(search: string, targets: SnapshotKey<T>, options?: Options<KeyResult<T>>): KeyResults<T>
    go<T>(search: string, targets: SnapshotKeys<T>, options?: Options<KeysResult<T>>): KeysResults<T>

    /** Prepare one target for fast searching */
    prepare(target: string): PreparedTarget

    /** Create an immutable snapshot for the best search performance; use when targets don't change */
    snapshot(targets: ReadonlyArray<string>): Snapshot
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
}

declare const fuzzysort: Fuzzysort.Fuzzysort
export default fuzzysort
