import {Store, Undo} from 'reactive-lens'
import {State, flagError, init} from './Model'
import {config} from './Config'
import {used_labels} from './../Graph/Graph'

/** A validation rule is specified over a data type T and optionally a context type C.

The context is meant to provide circumstances that the rule may take into account, like parts of app state. */
export interface ValidationRule<T> {
  readonly name: string
  readonly check: ValidationCheck<T>
}

function ValidationRule<T>(name: string, check: ValidationCheck<T>): ValidationRule<T> {
  return {name, check}
}

/** The validation check function takes the data to validate and a context object. */
export type ValidationCheck<T> = (data: T) => ValidationResult

/** The validation will either pass, or fail with a message. */
export type ValidationResult = {valid: true} | {valid: false; message: string}

/** A valid result. */
export const Valid: ValidationResult = {valid: true}
/** Create an invalid result.
  
  Invalid('foo') // => {valid: false, message: 'foo'}

*/
export const Invalid: (message: string) => ValidationResult = message => ({valid: false, message})

/** Validation rules for app state.

  const g_obs = {
    source: [{id: 'a0', text: 'x '}],
    target: [{id: 'b0', text: 'x '}],
    edges: {'e-a0-b0': {id: 'e-a0-b0', ids: ['a0', 'b0'], labels: ['OBS!'], manual: false}}
  }
  validationRules[0].check({...init, graph: Undo.init(g_obs), done: true}) // => {valid: false, message: 'OBS!'}
  validationRules[0].check({...init, graph: Undo.init(g_obs), done: false}) // => {valid: true}

*/
const validationRules: ValidationRule<State>[] = [
  ValidationRule('Temporary tags not allowed in completed normalization', state => {
    const usedTempLabels = used_labels(state.graph.now).filter(l => l in config.temporary_labels)
    return state.done && usedTempLabels.length ? Invalid([...usedTempLabels].join(',')) : Valid
  }),
]

/** Go through our rules and flag errors for any invalidations. */
export function validateState(store: Store<State>) {
  const state = store.get()
  for (let rule of validationRules) {
    let result = rule.check(state)
    if (!result.valid) {
      flagError(store, `${rule.name}: ${result.message}`)
    }
  }
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
    // If the changes result in invalid state, revert to ingoing state but with errors added.
    if (Object.keys(errors).length) {
      store.set({...prev, errors})
    }
  })
}
