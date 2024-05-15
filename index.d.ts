declare namespace Fuzzysort {

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
  interface KeyOptions<T> extends Options {
    key: string | ((obj: T) => string) | ReadonlyArray<string>
  }
  interface KeysOptions<T> extends Options {
    keys: ReadonlyArray<string | ((obj: T) => string) | ReadonlyArray<string>>
    scoreFn?: (keysResult: KeysResult<T>) => number
  }

  interface HighlightCallback<T> { (match: string, index: number): T }

  interface Fuzzysort {

    single(search: string, target: string | Prepared): Result | null

    go(search: string, targets: ReadonlyArray<string | Prepared>, options?: Options): Results
    go<T>(search: string, targets: ReadonlyArray<T>, options: KeyOptions<T>): KeyResults<T>
    go<T>(search: string, targets: ReadonlyArray<T>, options: KeysOptions<T>): KeysResults<T>

    /**
    * Help the algorithm go fast by providing prepared targets instead of raw strings
    */
    prepare(target: string): Prepared

    /**
    * Free memory caches if you're done using fuzzysort for now
    */
    cleanup(): void
  }
}

declare module "fuzzysort" {
  const fuzzysort:Fuzzysort.Fuzzysort
  export = fuzzysort
}
