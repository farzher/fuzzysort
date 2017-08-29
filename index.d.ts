declare module "fuzzysort" {

  interface Result {
    /**
    * Lower is better
    *
    * 0 is a perfect match; 1000 is a bad match
    */
    score: number

    /**
    * HTML
    *
    * The target string but with matches <b>bolded</b>
    */
    highlighted: string

    /**
    * Indexes of the matching target characters
    */
    indexes: number[]
  }

  interface Results {
    [index: number]: Result

    /**
    * Total matches before limit
    */
    total: number
  }

  interface Prepared {
    /**
    * The original target string
    */
    readonly _target: string
  }

  interface CancelablePromise<T> extends Promise<T> {
    cancel(): void
  }

  interface fuzzysort {
    /**
    * Turn this off if you don't care about `highlighted` (faster)
    */
    highlightMatches: boolean
    highlightOpen: string
    highlightClose: string

    /**
    * Don't return matches worse than this (lower is faster) (irrelevant for `single`)
    */
    threshold: number

    /**
    * Don't return more results than this (faster) (irrelevant for `single`)
    */
    limit: number

    /**
    * Help the algorithm go fast by providing prepared targets instead of raw strings
    *
    * Preparing is slow. Do it ahead of time and only once for each target string
    */
    prepare(target: string): Prepared
    single(search: string, target: string | Prepared): Result | null
    go(search: string, targets: string[] | Prepared[]): Results
    goAsync(search: string, targets: string[] | Prepared[]): CancelablePromise<Results>

    /**
     * Returns a new instance of fuzzysort, which you can give different options to
     */
    'new'(): fuzzysort
  }

  const fuzzysort: fuzzysort
  export = fuzzysort
}
