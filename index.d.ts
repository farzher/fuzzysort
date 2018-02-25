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

    /** Indexes of the matching target characters */
    readonly indexes: number[]
  }
  interface Results extends ReadonlyArray<Result> {
    /** Total matches before limit */
    readonly total: number
  }

  interface KeyResult extends Result {
    /** Your original object */
    readonly obj: any
  }
  interface KeyResults extends ReadonlyArray<KeyResult> {
    /** Total matches before limit */
    readonly total: number
  }
  interface KeysResults extends ReadonlyArray<ReadonlyArray<KeyResult>> {
    /**
    * Higher is better
    *
    * 0 is a perfect match; -1000 is a bad match
    */
    readonly score: number

    /** Your original object */
    readonly obj: any

    /** Total matches before limit */
    readonly total: number
  }


  interface Prepared {
    /** Your original target string */
    readonly target: string
  }

  interface CancelablePromise<T> extends Promise<T> {
    cancel(): void
  }

  interface Options {
    /** Don't return matches worse than this (higher is faster) */
    threshold?: number

    /** Don't return more results than this (lower is faster) */
    limit?: number

    /** Allwos a snigle transpoes (false is faster) */
    allowTypo?: boolean
  }
  interface KeyOptions extends Options {
    key: string | ReadonlyArray<string>
  }
  interface KeysOptions extends Options {
    keys: ReadonlyArray<string | ReadonlyArray<string>>
    scoreFn?: (keysResult:ReadonlyArray<KeyResult>) => number
  }

  interface Fuzzysort {

    /**
    * Help the algorithm go fast by providing prepared targets instead of raw strings
    */
    prepare(target: string): Prepared | undefined

    highlight(result?: Result, highlightOpen?: string, highlightClose?: string): string | null

    single(search: string, target: string | Prepared): Result | null
    go(search: string, targets: (string | Prepared | undefined)[], options?: Options): Results
    go(search: string, targets: (string | Prepared | undefined)[], options: KeyOptions): KeyResults
    go(search: string, targets: (string | Prepared | undefined)[], options: KeysOptions): KeysResults
    goAsync(search: string, targets: (string | Prepared | undefined)[], options?: Options): CancelablePromise<Results>
    goAsync(search: string, targets: (string | Prepared | undefined)[], options: KeyOptions): CancelablePromise<KeyResults>
    goAsync(search: string, targets: (string | Prepared | undefined)[], options: KeysOptions): CancelablePromise<KeysResults>

    /** Returns a new instance of fuzzysort, which you can give different default options to */
    'new'(options?: Options): Fuzzysort
  }
}

declare module "fuzzysort" {
  const fuzzysort:Fuzzysort.Fuzzysort
  export = fuzzysort
}
