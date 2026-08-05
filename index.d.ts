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


  /** An optimized snapshot of string targets returned by fuzzysort.prepare(). */
  interface Prepared {
    readonly [preparedBrand]: 'strings'
  }
  /** An optimized snapshot of object targets prepared by one key. */
  interface PreparedKey<T> {
    readonly [preparedBrand]: 'key'
    readonly _targetType?: T
  }
  /** An optimized snapshot of object targets prepared by multiple keys. */
  interface PreparedKeys<T> {
    readonly [preparedBrand]: 'keys'
    readonly _targetType?: T
  }

  interface Options {
    /** Don't return matches worse than this (higher is faster) */
    threshold?: number

    /** Don't return more results than this (lower is faster) */
    limit?: number

    /** If true, returns all results for an empty search */
    all?: boolean
  }
  type Key<T> = string | ((obj: T) => string) | ReadonlyArray<string>
  interface PrepareKeyOptions<T> {
    key: Key<T>
  }
  interface PrepareKeysOptions<T> {
    keys: ReadonlyArray<Key<T>>
  }
  interface KeyOptions<T> extends Options, PrepareKeyOptions<T> {}
  interface KeysOptions<T> extends Options, PrepareKeysOptions<T> {
    scoreFn?: (keysResult: KeysResult<T>) => number
  }

  interface HighlightCallback<T> { (match: string, index: number): T }

  interface Fuzzysort {

    single(search: string, target: string): Result | null

    go(search: string, targets: ReadonlyArray<string> | Prepared, options?: Options): Results
    go<T>(search: string, targets: ReadonlyArray<T>, options: KeyOptions<T>): KeyResults<T>
    go<T>(search: string, targets: ReadonlyArray<T>, options: KeysOptions<T>): KeysResults<T>
    go<T>(search: string, targets: PreparedKey<T>, options?: Options): KeyResults<T>
    go<T>(search: string, targets: PreparedKeys<T>, options?: Options & {scoreFn?: (keysResult: KeysResult<T>) => number}): KeysResults<T>

    /** Build an optimized snapshot for repeated searches. */
    prepare(targets: ReadonlyArray<string>): Prepared
    prepare<T>(targets: ReadonlyArray<T>, options: PrepareKeyOptions<T>): PreparedKey<T>
    prepare<T>(targets: ReadonlyArray<T>, options: PrepareKeysOptions<T>): PreparedKeys<T>

    /** Highlight a result, including one received through structuredClone or postMessage */
    highlight(result: Result, highlightOpen?: string, highlightClose?: string): string
    highlight<T>(result: Result, callback: HighlightCallback<T>): (string | T)[]

    /** Read the normalized score of a result received through structuredClone or postMessage */
    score(result: Result | KeysResult<unknown>): number

    /** Add or override character normalization mappings. */
    remap(mappings: Readonly<Record<string, string>>): void

    /**
    * Free memory caches if you're done using fuzzysort for now
    */
    cleanup(): void
  }
}

declare const fuzzysort: Fuzzysort.Fuzzysort
export default fuzzysort
