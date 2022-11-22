declare namespace Fuzzysort {
  interface Result {
    /**
    * Higher is better
    *
    * 0 is a perfect match; -1000 is a bad match
    */
    readonly score: number

    /** Your original target string */
    readonly target: string
  }
  interface Results extends ReadonlyArray<Result> {
    /** Total matches before limit */
    readonly total: number
  }

  interface KeyResult<T> extends Result {
    /** Your original object */
    readonly obj: T
  }
  interface KeysResult<T> extends ReadonlyArray<Result> {
    /**
    * Higher is better
    *
    * 0 is a perfect match; -1000 is a bad match
    */
   readonly score: number

    /** Your original object */
    readonly obj: T
  }
  interface KeyResults<T> extends ReadonlyArray<KeyResult<T>> {
    /** Total matches before limit */
    readonly total: number
  }
  interface KeysResults<T> extends ReadonlyArray<KeysResult<T>> {
    /** Total matches before limit */
    readonly total: number
  }


  interface Prepared {
    /** Your original target string */
    readonly target: string
  }

  interface Options {
    /** Don't return matches worse than this (higher is faster) */
    threshold?: number

    /** Don't return more results than this (lower is faster) */
    limit?: number

    /** If true, returns all results for an empty search */
    all?: boolean
  }
  interface KeyOptions extends Options {
    key: string | ReadonlyArray<string>
  }
  interface KeysOptions<T> extends Options {
    keys: ReadonlyArray<string | ReadonlyArray<string>>
    scoreFn?: (keysResult:ReadonlyArray<KeyResult<T>>) => number | null
  }

  interface HighlightCallback<T> { (match: string, index: number): T }

  interface Fuzzysort {

    single(search: string, target: string | Prepared): Result | null

    go(search: string, targets: ReadonlyArray<string | Prepared | undefined>, options?: Options): Results
    go<T>(search: string, targets: ReadonlyArray<T | undefined>, options: KeyOptions): KeyResults<T>
    go<T>(search: string, targets: ReadonlyArray<T | undefined>, options: KeysOptions<T>): KeysResults<T>

    highlight(result?: Result, highlightOpen?: string, highlightClose?: string): string | null
    highlight<T>(result: Result, callback: HighlightCallback<T>): (string | T)[] | null

    indexes(result: Result): ReadonlyArray<Number>
    cleanup(): void

    /**
    * Help the algorithm go fast by providing prepared targets instead of raw strings
    */
    prepare(target: string): Prepared

  }
}

declare module "fuzzysort" {
  const fuzzysort:Fuzzysort.Fuzzysort
  export = fuzzysort
}
