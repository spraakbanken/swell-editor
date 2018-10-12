import {Store} from 'reactive-lens'
import {State, flagError} from './Model'
import {config} from './Config'
import {Graph} from './../Graph/Graph'
import * as record from '../record'

/** A validation rule is specified over a data type T and optionally a context type C.

The context is meant to provide circumstances that the rule may take into account, like parts of app state. */
export interface ValidationRule<T, C = any> {
  readonly name: string
  readonly check: ValidationCheck<T, C>
}

function ValidationRule<T, C = any>(
  name: string,
  check: ValidationCheck<T, C>
): ValidationRule<T, C> {
  return {name, check}
}

/** The validation check function takes the data to validate and a context object. */
export type ValidationCheck<T, C = any> = (data: T, context: C) => ValidationResult

/** The validation will either pass, or fail with a message. */
export type ValidationResult = {valid: true} | {valid: false; message: string}

/** A valid result. */
export const Valid: ValidationResult = {valid: true}
/** Create an invalid result.
  
  Invalid('foo') // => {valid: false, message: 'foo'}

*/
export const Invalid: (message: string) => ValidationResult = message => ({valid: false, message})

/** The validation context for a graph. */
export type GraphValidationContext = {done: boolean | undefined}

/** Validation rules for a graph.

  const g_obs = {
    source: [{id: 'a0', text: 'x '}],
    target: [{id: 'b0', text: 'x '}],
    edges: {'e-a0-b0': {id: 'e-a0-b0', ids: ['a0', 'b0'], labels: ['OBS!'], manual: false}}
  }
  graphValidationRules[0].check(g_obs, {done: true}) // => {valid: false, message: 'OBS!'}

*/
const graphValidationRules: ValidationRule<Graph, GraphValidationContext>[] = [
  ValidationRule('Temporary tags not allowed in completed normalization', (g, {done}) => {
    const usedTempLabels = new Set()
    record.forEach(g.edges, (edge, id) =>
      edge.labels.forEach(l => l in config.temporary_labels && usedTempLabels.add(l))
    )
    return done && usedTempLabels.size ? Invalid([...usedTempLabels].join(',')) : Valid
  }),
]

/** Go through our rules and flag errors for any invalidations. */
export function validateLabels(store: Store<State>) {
  const state = store.get()
  const context = {
    done: state.done,
  }
  for (let rule of graphValidationRules) {
    let result = rule.check(state.graph.now, context)
    if (!result.valid) {
      flagError(store, `${rule.name}: ${result.message}`)
    }
  }
}
