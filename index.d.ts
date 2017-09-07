declare module "fuzzysort" {

  interface Result {
    /**
    * Higher is better
    *
    * 0 is a perfect match; -1000 is a bad match
    */
    readonly score: number

    /** Your original target string */
    readonly target: string

    /** Indexes of the matching target characters */
    readonly indexes: number[]
  }
  interface KeyResult extends Result {
    /** Your original object */
    readonly obj: any
  }

  interface Results {
    readonly [index: number]: Result

    /** Total matches before limit */
    readonly total: number
  }
  interface KeyResults extends Results {
    readonly [index: number]: KeyResult
  }
  interface KeysResults {
    readonly [index: number]: Array<KeyResult>

    /** Total matches before limit */
    readonly total: number

    /** Your original object */
    readonly obj: any

    /**
    * Higher is better
    *
    * 0 is a perfect match; -1000 is a bad match
    */
    readonly score: number
  }


  interface Prepared {
    /** Your original target string */
    readonly _target: string
  }

  interface CancelablePromise<T> extends Promise<T> {
    cancel(): void
  }

  interface Options {
    /** Don't return matches worse than this (faster) */
    threshold?: number

    /** Don't return more results than this (faster) */
    limit?: number
  }
  interface KeyOptions extends Options {
    key: string | Array<string>
  }
  interface KeysOptions extends Options {
    keys: Array<string | Array<string>>
  }

  interface fuzzysort {

    /**
    * Help the algorithm go fast by providing prepared targets instead of raw strings
    *
    * Preparing is slow. Do it ahead of time and only once for each target string
    */
    prepare(target: string): Prepared

    highlight(result: Result, highlightOpen?: string, highlightClose?: string): string

    single(search: string, target: string | Prepared): Result | null
    go(search: string, targets: string[] | Prepared[], options?: Options): Results
    go(search: string, targets: string[] | Prepared[], options: KeyOptions): KeyResults
    go(search: string, targets: string[] | Prepared[], options: KeysOptions): KeysResults
    goAsync(search: string, targets: string[] | Prepared[], options?: Options): CancelablePromise<Results>
    goAsync(search: string, targets: string[] | Prepared[], options: KeyOptions): CancelablePromise<KeyResults>
    goAsync(search: string, targets: string[] | Prepared[], options: KeysOptions): CancelablePromise<KeysResults>

    /** Returns a new instance of fuzzysort, which you can give different default options to */
    'new'(options?: Options): fuzzysort
  }

  const fuzzysort: fuzzysort
  export = fuzzysort
}
