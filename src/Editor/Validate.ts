import {Store, Undo} from 'reactive-lens'
import {State, init, modes, clearValidationMessages, flagValidationMessage} from './Model'
import {LabelOrder, label_order, find_label} from './Config'
import * as G from '../Graph'
import * as record from '../record'

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
  validationRules[0].check({...init, graph: Undo.init(g0), mode: 'anonymization', done: true}) // => [{severity: Severity.ERROR, message: '"x"'}]
  validationRules[0].check({...init, graph: Undo.init(g0), mode: 'normalization', done: true}) // => [{severity: Severity.ERROR, message: '"x"'}]
  validationRules[0].check({...init, graph: Undo.init(g0), mode: 'anonymization', done: false}) // => []

  const g1 = {
    source: [{id: 'a0', text: 'x '}],
    target: [{id: 'b0', text: 'y '}],
    edges: {'e-a0-b0': {id: 'e-a0-b0', ids: ['a0', 'b0'], labels: [], manual: false}}
  }
  validationRules[1].check({...init, graph: Undo.init(g1)}) // => [{severity: Severity.WARNING, message: '"x"'}]

  const g2 = {
    source: [{id: 'a0', text: 'x '}],
    target: [{id: 'b0', text: 'x '}],
    edges: {'e-a0-b0': {id: 'e-a0-b0', ids: ['a0', 'b0'], labels: ['firstname:female', 'region', 'OBS!', 'gen', 'ort'], manual: false}}
  }
  validationRules[2].check({...init, graph: Undo.init(g2), mode: 'anonymization'}) // => [{severity: Severity.ERROR, message: '"x"'}]

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
  Rule(
    'Temporary tags not allowed when done',
    edge_check(
      state => !!state.done,
      edge => edge.labels.filter(l => label_order(l) == LabelOrder.TEMP).length > 0
    )
  ),
  Rule(
    'Normalization missing a label',
    edge_check(
      state => state.mode == modes.normalization,
      (edge, source, target) => G.text(source) != G.text(target) && edge.labels.length == 0,
      Severity.WARNING
    )
  ),
  Rule(
    'Too many main labels',
    edge_check(
      state => state.mode == modes.anonymization,
      edge =>
        edge.labels.filter(l => {
          const find = find_label(l)
          return find && find.taxonomy == 'anonymization' && label_order(l) == LabelOrder.BASE
        }).length > 1
    )
  ),
  Rule(
    'Running number missing',
    edge_check(
      state => state.mode == modes.anonymization && !!state.done,
      edge =>
        edge.labels.filter(l => label_order(l) == LabelOrder.BASE).length > 0 &&
        edge.labels.filter(l => label_order(l) == LabelOrder.NUM).length == 0
    )
  ),
  Rule(
    'Running number used alone',
    edge_check(
      state => state.mode == modes.anonymization && !!state.done,
      edge =>
        edge.labels.filter(l => label_order(l) == LabelOrder.NUM).length > 0 &&
        edge.labels.filter(l => label_order(l) == LabelOrder.BASE).length == 0
    )
  ),
]

/** Create a check function from a generic condition (whether to run the rule at all) and a specific edge condition. */
function edge_check(
  cond: (state: State) => boolean,
  check: (edge: G.Edge, source: G.Token[], target: G.Token[]) => boolean,
  severity: Severity = Severity.ERROR
): Check<State> {
  return state => {
    // Exit early if generic condition fails.
    if (!cond(state)) return []
    // Emit an error for each edge where the edge condition fails.
    const emits: Result[] = []
    record.map(state.graph.now.edges, edge => {
      const {source, target} = G.partition_ids(state.graph.now)(edge)
      if (edge && check(edge, source, target)) {
        // Use the supplied resulter, or create an Error by default.
        emits.push({message: `"${G.text(source).trim()}"`, severity})
      }
    })
    return emits
  }
}

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
