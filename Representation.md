# The parallel corpus representation

The graph is stored in a data type which has the following type:

```typescript
interface Graph {
  source: Token[]
  target: Token[]
  edges: Record<string, Edge>
}

interface Token {
  text: string
  /** an identifier that is unique over the whole graph */
  id: string
}

interface Edge {
  /** a convenience copy of the identifier used in the edges object of the graph */
  id: string
  /** these are ids to source and target tokens */
  ids: string[]
  /** labels on this edge */
  labels: string[]
  /** is this manually or automatically aligned */
  manual: boolean
}
```

## Invariant

The graph is subject to an invariant (checked with the function `check_invariant`):
* all defined identifiers are unique over the graph
* all referenced identifiers exist
* text tokens match the regex `/\s*\S+\s+/`
* the graph is aligned

## Example

A graph with source and target texts each being `w1 w2 `:

```javascript
{
  "source": [{"id": "s0", "text": "w1 "}, {"id": "s1", "text": "w2 "}],
  "target": [{"id": "t0", "text": "w1 "}, {"id": "t1", "text": "w2 "}],
  "edges": {
    "e-s0-t0": {
      "id": "e-s0-t0",
      "ids": ["s0", "t0"],
      "labels": [],
      "manual": false
    },
    "e-s1-t1": {
      "id": "e-s1-t1",
      "ids": ["s1", "t1"],
      "labels": [],
      "manual": false
    }
  }
}
```

The source word `apa` automatically aligned with `bepa`, with the label `"A"`:
```javascript
{
  "source": [{"id": "s0", "text": "apa "}],
  "target": [{"id": "t0", "text": "bepa "}],
  "edges": {
    "e-s0-t0": {
      "id": "e-s0-t0",
      "ids": ["s0", "t0"],
      "labels": ["A"],
      "manual": false
    }
  }
}
```

## The diff view

There is a derived form of looking at the data which is used to draw the graph
in the interface. The data types look like this:

```typescript
interface Dropped {
  edit: 'Dropped'
  target: Token
  id: string
  manual: boolean
}

interface Dragged {
  edit: 'Dragged'
  source: Token
  id: string
  manual: boolean
}

interface Edited {
  edit: 'Edited'
  source: Token[]
  target: Token[]
  id: string
  manual: boolean
}
```

The names are inspired by that Edited have a fixed position and the displaced
tokens have been Dragged from somewhere in the source text and Dropped somewhere in the target text.

Additionally there is an enriched version that gives intra-token character-diffs:

```typescript
type RichDiff =
  | Edited & {index: number} & {target_diffs: TokenDiff[]; source_diffs: TokenDiff[]}
  | Dragged & {index: number} & {source_diff: TokenDiff}
  | Dropped & {index: number} & {target_diff: TokenDiff}

type TokenDiff = [-1 | 0 | 1 /* deleted, unmodified, inserted */, string][]
```

