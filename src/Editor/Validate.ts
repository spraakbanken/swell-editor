import {Store, Undo} from 'reactive-lens'
import {State, flagError, init, flagWarning} from './Model'
import {config} from './Config'
import * as G from '../Graph'
import * as T from '../Graph/Token'

/** A validation rule is specified over a data type T and optionally a context type C.

The context is meant to provide circumstances that the rule may take into account, like parts of app state. */
interface Rule<T> {
  readonly name: string
  readonly check: Check<T>
}

function Rule<T>(name: string, check: Check<T>): Rule<T> {
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

/** Create a validation warning.

  Warning('foo') // => {severity: Severity.WARNING, message: 'foo'}

*/
const Warning: (message: string) => Result = message => ({
  severity: Severity.WARNING,
  message,
})

/** Create a validation error.

  Error('foo') // => {severity: Severity.ERROR, message: 'foo'}

*/
const Error: (message: string) => Result = message => ({severity: Severity.ERROR, message})

/** Validation rules for app state.

  const g_obs = {
    source: [{id: 'a0', text: 'x '}],
    target: [{id: 'b0', text: 'x '}],
    edges: {'e-a0-b0': {id: 'e-a0-b0', ids: ['a0', 'b0'], labels: ['OBS!'], manual: false}}
  }
  validationRules[0].check({...init, graph: Undo.init(g_obs), done: true}) // => [{severity: Severity.ERROR, message: 'OBS!'}]
  validationRules[0].check({...init, graph: Undo.init(g_obs), done: false}) // => []

*/
const validationRules: Rule<State>[] = [
  Rule('Temporary tags not allowed in completed normalization', state => {
    const usedTempLabels = G.used_labels(state.graph.now).filter(l => l in config.temporary_labels)
    return state.done && usedTempLabels.length ? [Error([...usedTempLabels].join(','))] : []
  }),
  Rule('Normalization missing a label', state =>
    // Get edges without labels.
    Object.values(state.graph.now.edges)
      .filter(edge => edge.labels.length == 0)
      // Pick the ones where source and target differ.
      .map(edge => G.partition_ids(state.graph.now)(edge))
      .filter(({source, target}) => T.text(source) != T.text(target))
      // Make a warning for each such edge.
      .map(({source, target}) => Warning(`"${T.text(target)}"`))
  ),
]

/** Go through our rules and flag errors for any invalidations. */
export function validateState(store: Store<State>) {
  // Clear warnings. (Errors are directly visible and must be removed manually.)
  store.at('warnings').set({})
  const state = store.get()
  validationRules.forEach(rule => {
    rule.check(state).forEach(result => {
      let flag = result.severity == Severity.ERROR ? flagError : flagWarning
      flag(store, `${rule.name}: ${result.message}`)
    })
  })
}

/** Make changes, validate new state and revert changes if the result is invalid. */
export function validation_transaction(store: Store<State>, f: (s: Store<State>) => void): void {
  // Avoid triggering listeners until we're done.
  store.transaction(() => {
    // Remember ingoing state.
    const prev = store.get()
    // Perform changes.
    f(store)
    // Validate new state.
    validateState(store)
    const errors = store.at('errors').get()
    const warnings = store.at('warnings').get()
    // If the changes result in invalid state, revert to ingoing state but with errors added.
    if (Object.keys(errors).length) {
      store.set({...prev, errors, warnings})
    }
  })
}
