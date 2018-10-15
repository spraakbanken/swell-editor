import * as R from 'ramda'
import {Store, Undo} from 'reactive-lens'
import {State, flagError, init, flagWarning, modes} from './Model'
import {config} from './Config'
import * as G from '../Graph'
import * as Utils from '../Utils'

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

  const g0 = {
    source: [{id: 'a0', text: 'x '}],
    target: [{id: 'b0', text: 'x '}],
    edges: {'e-a0-b0': {id: 'e-a0-b0', ids: ['a0', 'b0'], labels: ['OBS!'], manual: false}}
  }
  validationRules[0].check({...init, graph: Undo.init(g0), mode: 'anonymization', done: true}) // => [{severity: Severity.ERROR, message: 'OBS!'}]
  validationRules[0].check({...init, graph: Undo.init(g0), mode: 'anonymization', done: false}) // => []

  const g1 = {
    source: [{id: 'a0', text: 'x '}],
    target: [{id: 'b0', text: 'y '}],
    edges: {'e-a0-b0': {id: 'e-a0-b0', ids: ['a0', 'b0'], labels: [], manual: false}}
  }
  validationRules[1].check({...init, graph: Undo.init(g1)}) // => [{severity: Severity.WARNING, message: '"y"'}]

  const g2 = {
    source: [{id: 'a0', text: 'x '}],
    target: [{id: 'b0', text: 'x '}],
    edges: {'e-a0-b0': {id: 'e-a0-b0', ids: ['a0', 'b0'], labels: ['firstname:female', 'region', 'OBS!', 'gen', 'ort'], manual: false}}
  }
  validationRules[2].check({...init, graph: Undo.init(g2), mode: 'anonymization'}) // => [{severity: Severity.ERROR, message: '"x" cannot have firstname:female and region'}]

*/
const validationRules: Rule<State>[] = [
  Rule('Temporary tags not allowed in completed normalization', state => {
    const usedTempLabels = G.used_labels(state.graph.now).filter(l => l in config.temporary_labels)
    return state.mode == modes.anonymization && state.done && usedTempLabels.length
      ? [Error([...usedTempLabels].join(','))]
      : []
  }),
  Rule(
    'Normalization missing a label',
    state =>
      // Get edges without labels.
      state.mode != modes.normalization
        ? []
        : Object.values(state.graph.now.edges)
            .filter(edge => edge.labels.length == 0)
            // Pick the ones where source and target differ.
            .map(edge => G.partition_ids(state.graph.now)(edge))
            .filter(({source, target}) => G.text(source) != G.text(target))
            // Make a warning for each such edge.
            .map(({source, target}) => Warning(`"${G.text(target).trim()}"`))
  ),
  Rule('Too many main labels', state => {
    if (state.mode != modes.anonymization) {
      return []
    }
    const g = state.graph.now
    const edge_map = G.edge_map(g)
    // "Main labels" are those which do not belong to an additional group.
    const mainLabels = Utils.flatten(
      config.taxonomy.anonymization
        .filter(group => !group.additional)
        .map(group => group.entries.map(R.path(['label'])))
    )
    // Check the edge for each token, if it has multiple main labels.
    const emits: Result[] = []
    g.source.forEach(({id, text}) => {
      const edge = edge_map.get(id)
      let usedMainLabels = edge ? R.intersection(edge.labels, mainLabels) : []
      if (usedMainLabels.length > 1) {
        emits.push(Error(`"${text.trim()}" cannot have ${usedMainLabels.join(' and ')}`))
      }
    })
    return emits
  }),
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
