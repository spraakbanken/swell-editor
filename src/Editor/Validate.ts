import {Store, Undo} from 'reactive-lens'
import {State, init, modes, clearValidationMessages, flagValidationMessage} from './Model'
import {LabelOrder, label_order, find_label} from './Config'
import * as G from '../Graph'

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
  validationRules[0].check({...init, graph: Undo.init(g0), mode: 'normalization', done: true}) // => [{severity: Severity.ERROR, message: 'OBS!'}]
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

  const g3 = {
    source: [{id: 'a0', text: 'x '}, {id: 'a1', text: 'y '}],
    target: [{id: 'b0', text: 'x '}, {id: 'b1', text: 'y '}],
    edges: {
      'e-a0-b0': {id: 'e-a0-b0', ids: ['a0', 'b0'], labels: ['firstname:female'], manual: false},
      'e-a1-b1': {id: 'e-a1-b1', ids: ['a1', 'b1'], labels: ['firstname:female', '1'], manual: false},
    }
  }
  validationRules[3].check({...init, graph: Undo.init(g3), mode: 'anonymization', done: true}) // => [{severity: Severity.ERROR, message: '"x"'}]
  validationRules[3].check({...init, graph: Undo.init(g3), done: true}) // => []
  validationRules[3].check({...init, graph: Undo.init(g3), mode: 'anonymization'}) // => []

  const g4 = {
    source: [{id: 'a0', text: 'x '}, {id: 'a1', text: 'y '}],
    target: [{id: 'b0', text: 'x '}, {id: 'b1', text: 'y '}],
    edges: {
      'e-a0-b0': {id: 'e-a0-b0', ids: ['a0', 'b0'], labels: ['1'], manual: false},
      'e-a1-b1': {id: 'e-a1-b1', ids: ['a1', 'b1'], labels: ['firstname:female', '1'], manual: false},
    }
  }
  validationRules[4].check({...init, graph: Undo.init(g4), mode: 'anonymization', done: true}) // => [{severity: Severity.ERROR, message: '"x"'}]
  validationRules[4].check({...init, graph: Undo.init(g4), done: true}) // => []
  validationRules[4].check({...init, graph: Undo.init(g4), mode: 'anonymization'}) // => []

*/
const validationRules: Rule<State>[] = [
  Rule('Temporary tags not allowed when done', state => {
    const usedTempLabels = G.used_labels(state.graph.now).filter(
      l => label_order(l) == LabelOrder.TEMP
    )
    return state.done && usedTempLabels.length ? [Error([...usedTempLabels].join(','))] : []
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
    // Check the edge for each token, if it has multiple main labels.
    const emits: Result[] = []
    g.source.forEach(({id, text}) => {
      const edge = edge_map.get(id)
      let usedMainLabels = edge
        ? edge.labels.filter(l => {
            const find = find_label(l)
            return find && find.taxonomy == 'anonymization' && label_order(l) == LabelOrder.BASE
          })
        : []
      if (usedMainLabels.length > 1) {
        emits.push(Error(`"${text.trim()}" cannot have ${usedMainLabels.join(' and ')}`))
      }
    })
    return emits
  }),
  Rule('Running number missing', state => {
    if (state.mode != modes.anonymization || !state.done) {
      return []
    }
    const g = state.graph.now
    const edge_map = G.edge_map(g)
    const emits: Result[] = []
    g.source.forEach(({id, text}) => {
      const edge = edge_map.get(id)
      // Has base label but no number label.
      if (
        edge &&
        edge.labels.filter(l => label_order(l) == LabelOrder.BASE).length &&
        edge.labels.filter(l => label_order(l) == LabelOrder.NUM).length == 0
      ) {
        emits.push(Error(`"${text.trim()}"`))
      }
    })
    return emits
  }),
  Rule('Running number used alone', state => {
    if (state.mode != modes.anonymization || !state.done) {
      return []
    }
    const g = state.graph.now
    const edge_map = G.edge_map(g)
    const emits: Result[] = []
    g.source.forEach(({id, text}) => {
      const edge = edge_map.get(id)
      // Has number label but no base label.
      if (
        edge &&
        edge.labels.filter(l => label_order(l) == LabelOrder.NUM).length &&
        edge.labels.filter(l => label_order(l) == LabelOrder.BASE).length == 0
      ) {
        emits.push(Error(`"${text.trim()}"`))
      }
    })
    return emits
  }),
]

/** Go through our rules and flag errors for any invalidations. */
export function validateState(store: Store<State>) {
  clearValidationMessages(store)
  const state = store.get()
  validationRules.forEach(rule => {
    rule.check(state).forEach(result => {
      flagValidationMessage(store, `${rule.name}: ${result.message}`, result.severity)
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
    const validation_messages = store.at('validation_messages').get()
    const errors = validation_messages.filter(msg => msg.severity == Severity.ERROR)
    // If the changes result in invalid state, revert to ingoing state but with messages added.
    if (errors !== undefined && Object.keys(errors).length) {
      store.set({...prev, validation_messages})
    }
  })
}
