import * as G from '../Graph'
import * as record from '../record'

/** A validation rule is specified over a data type T and optionally a context type C.

The context is meant to provide circumstances that the rule may take into account, like parts of app state. */
export interface Rule<T> {
  readonly name: string
  readonly check: Check<T>
}

export function Rule<T>(name: string, check: Check<T>): Rule<T> {
  return {name, check}
}

/** The validation check function takes the data to validate and a context object. */
type Check<T> = (data: T) => Result[]

/** The validation will either pass, or fail with a message. */
export type Result = {severity: Severity; message: string}

export enum Severity {
  WARNING = 'warning',
  ERROR = 'error',
}

/** Create a check function from a generic condition (whether to run the rule at all) and a specific edge condition. */
export function edge_check<S>(
  cond: (state: S) => boolean,
  check: (edge: G.Edge, source: G.Token[], target: G.Token[]) => boolean,
  severity: Severity = Severity.ERROR
): Check<{state: S; g: G.Graph}> {
  return ({state, g}) => {
    // Exit early if generic condition fails.
    if (!cond(state)) return []
    // Emit an error for each edge where the edge condition fails.
    const emits: Result[] = []
    record.map(g.edges, edge => {
      const {source, target} = G.partition_ids(g)(edge)
      if (edge && check(edge, source, target)) {
        // Use the supplied resulter, or create an Error by default.
        emits.push({message: `"${G.text(source).trim()}"`, severity})
      }
    })
    return emits
  }
}
