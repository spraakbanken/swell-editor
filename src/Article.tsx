import * as record from './record'

import * as R from 'ramda'
import * as React from 'react'
import {Store} from 'reactive-lens'
import {style, types} from 'typestyle'
import * as csstips from 'csstips'

import * as D from './Diff'
import * as G from './Graph'
import * as L from './LadderView'
import {Align, align} from './LadderView'
import * as C from './Compact'

import * as RD from './RichDiff'
import * as T from './Token'
import * as Utils from './Utils'

import {VNode} from './LadderView'

import {md} from './Slides'

export interface State {}

export const init: State = {}

export function App(store: Store<State>): () => VNode {
  return () => View(store)
}

const ArticleStyle = style(Utils.debugName('ArticleStyle'), {
  boxSizing: 'border-box',
  minWidth: '200px',
  maxWidth: '980px',
  margin: '0 auto',
  padding: '45px',
  color: '#24292e',
  fontFamily:
    'Lato, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
  lineHeight: 1.5,
  wordWrap: 'break-word',
  $nest: {
    '& .ladder': {
      fontFamily: 'Lato',
    },
    [Utils.range(6)
      .map(i => `& h${i + 1}`)
      .join(', ')]: {
      fontWeight: 600,
      lineHeight: 1.25,
      marginTop: '0px',
      marginBottom: '16px',
      paddingBottom: '10px',
      borderBottom: '1px solid rgb(234, 236, 239)',
    },
    '& table': {
      padding: '0',
      marginBottom: '16px',
    },
    '& table tr': {
      borderTop: '1px solid #cccccc',
      backgroundColor: 'white',
      margin: '0',
      padding: '0',
    },
    '& table tr:nth-child(2n)': {
      backgroundColor: '#f8f8f8',
    },
    '& table tr th': {
      fontWeight: 'bold',
      border: '1px solid #cccccc',
      textAlign: 'left',
      margin: '0',
      padding: '6px 13px',
    },
    '& table tr td': {
      border: '1px solid #cccccc',
      textAlign: 'left',
      margin: '0',
      padding: '6px 13px',
    },
    '& table tr th :first-child, table tr td :first-child': {
      marginTop: '0',
    },
    '& table tr th :last-child, table tr td :last-child': {
      marginBottom: '0',
    },
    '& .NoManualBlue .GreyPath.Manual': {
      stroke: '#999',
    },
  },
})

export function alignment(): VNode {
  function go(s: string, t: string) {
    const g0 = G.init(s)
    const g = G.set_target(g0, t)

    const st = {source: s, target: t}
    const punctuated = G.with_st(st, (s, side) =>
      Utils.flatMap(T.tokenize(s), (text, i) =>
        Utils.str_map(text, c => ({text: c, labels: [side[0] + i]}))
      )
    )

    const g_label = G.from_unaligned(punctuated)
    const g_unlab = {
      ...g_label,
      edges: record.map(g_label.edges, ({labels, ...e}) => ({...e, labels: []})),
    }

    return {g0, g, g_label, g_unlab}
  }

  const s = 'Examples high light lotsof futures always'
  const t = 'Examples always highlight lots of features'

  const full = go(s, t)
  const wo_always = go(s.replace(' always', ''), t.replace(' always', ''))

  return md`

    ## Alignment procedure

    Initially we start with the target being equal to the source:

    ${L.Ladder(full.g0)}

    We want to edit the target text like it were in an input text box without
    considering that the tokens in the text is part of a linked structure.

    If we just edit it by changing it we get

    ${L.Ladder(full.g)}

    Most of it is correct. How has this happened?
    Start with a standard diff edit script on the _character-level_:

    ${L.Ladder(full.g_unlab)}

    We calculate this using Myers' diff algorithm provided by the
    [diff-match-patch](https://github.com/google/diff-match-patch) library.
    How do we now reflect this to the token level?
    By identifying each character with the token it originated from. We name them
    _s0_, _s1_, ... for the source tokens and _t0_, _t1_, ... for the target tokens.
    We don't identify the spaces with anything. The diff with each character link
    associated with the ids it is related to looks like this:

    ${L.Ladder(full.g_label)}

    We now read off from this which tokens should be aligned, namely into these six groups:

    | group | token identifiers | source words | target words |
    | ---   | ---               | ---          | ---          |
    | 1     | s0 t0             | Examples     | Examples     |
    | 2     | t1                |              | always       |
    | 3     | s1 s2 t2          | high light   | highlight    |
    | 4     | s3 t3 t4          | lotsof       | lots of      |
    | 5     | s4  t5            | futures      | features     |
    | 6     | s5                | always       |              |

    Writing parallell corpora this way is sometimes called standoff and is used in tools like Falco.

    ### Manual alignment

    The user could conceivable correct aligments in many ways, including:

    1. _preemptively_ by manually moving the word by drag and drop in the graph (or similar techniques)
    2. _as a fix-up stage_ by adding a link by merging the two links by using the mouse in the graph

    In our editor only the second alternative is implemented since doing many operations of drag and drop
    is tiring. So the user selects the two always and indicates to the editor that these should be manually
    aligned. We are now in a stage where part of the parallell sentences have
    one manual alignment regarding the word _always_. The plan is to do the same procedure as before
    but without the manually aligned _always_: we will first _remove_ them, align the rest of the text
    automatically, and then _insert_ them in the correct position.

    We thus proceed by removing that word and aligning the rest of the text automatically to get this:

    ${L.Ladder(wo_always.g_unlab)}

    However, when we consider the identifiers as well we see that the identifiers _t1_ and _s5_ for _always_
    are skipped (because we already know how to connect these):

    ${L.Ladder(wo_always.g_label)}

    We now read off the aligments from there  to get:

    ${L.Ladder(wo_always.g)}

    We can now insert the missing words into their correct places based on position in the respective sentences
    to get the desired alignment:

    ${Align(
      'Examples high light lotsof futures always',
      'Examples always~always highlight lots of features'
    )}

    The editor indicates that this is a edge is manual colouring it blue.
    These edges interact with other edges differently from the automatically aligned
    grey edges, how is explained in the next section.

    ### Editing in the presence of manual and automatic alignments

    The tokens that have been manually aligned are remembered. While the
    user edits the target hypothesis things are straight-forward as long as the
    edit is wholly in an automatic section or a manual section. When
    editing across these boundaries the manual segment is contagious and
    extends as much as it need be.

    Thus if we select _always highlight_ and replace it with _alwayXighligt_ the state before is:

    ${Align(
      'Examples high light lotsof futures always',
      'Examples always~always highlight lots of features'
    )}

    and after:

    ${Align(
      'Examples high light lotsof futures always',
      'Examples alwayXighlight~high~light~always lots of features'
    )}

    However, if we across the boundary of _of features_ to _oXeatures_ we get:

    ${Align(
      'Examples high light lotsof futures always',
      'Examples always~always highlight lots oXeatures'
    )}

    Here the edit was not contagious: the automatic alignment decided to
    not make a big component, instead it chose to split to align the words independently.

    In our editor there is a way to untag something as manually aligned to make
    it fall back to the automatic aligner in case it has absorbed too much.
    `
}

export function View(store: Store<State>): VNode {
  const intro = md`
    # Mostly Automatic Word Alignment of Parallel Corpora

    _Dan Rosén dan.rosen@svenska.gu.se 2018_

    An error-corrected learner text can be seen as a parallel corpora from
    the source text written by the learner to target hypothesis text. We
    would like precise word alignments between these two texts and develop
    an editor which aligns these automatically and lets the user manually
    link the (unevitable) mistakes from the automatic alignment. We note
    that the situation is not exclusive to learner corpora but could be
    viable between other language pairs given that they are similar enough,
    for example the Scandinavian languages.

    Here is a hypothetical example of such an alignment:

    ${(
      <div className="NoManualBlue">
        {Align(
          'Examples high light lotsof futures always',
          'Examples always~always highlight lots of features'
        )}
      </div>
    )}

    A natural place to put annotations is on the edges of these:

    ${(
      <div className="NoManualBlue">
        {Align(
          "Examples high light:undercompound lotsof:overcompound futures:'ortography||word choice' always:'word order'",
          'Examples always~always highlight lots~lotsof of~lotsof features'
        )}
      </div>
    )}

    We will not focus more about such labels in this text but simply highlight
    that this is a possibility.
  `

  const future = md`
    ## Future work

    Automatic alignment could be based on something but character-level diffs. A
    token-based diff could be used where the distance between tokens are
    calculated between word embeddings in a shared embedding space for the
    two languages.

    The visualisation can be rotated 90 degrees to work with sentence-aligned
    parallell corpora.

    ## Gallery
  `

  const gallery = [
    ` a b       // b c               `,
    ` b c       // a b~b             `,
    ` a b       // b a~a             `,
    ` b a       // a b~b             `,
    ` a bc      // b c a~a           `,
    ` b c a     // a~a bc            `,
    ` abbc      // ab bc             `,
    ` ab bc     // abbc              `,
    ` ab qp ef  // abq pef           `,
    ` a x b     // A~a~b x           `,
    ` a x b     // x A~a~b           `,
    ` a b       // ins b a~a         `,
    ` b a del   // a~a b             `,
    ` a b       // b a~a ins         `,
    ` del b a   // a~a b             `,
    ` a x b y c // w~a~b~c x y       `,
    ` a x b y c // x w~a~b~c y       `,
    ` a x b y c // x y w~a~b~c       `,
    ` a x b y c // w~a~b~c x~x~y y~y `,
    ` a x b y c // x~x~y w~a~b~c y~y `,
    ` a x b y c // x~x~y y~y w~a~b~c `,
    ` b~@2 b~@2 a~@1 a~@1 a~@1 // a@1  a~@1 a~@1 b@2 b~@2 b~@2 b~@2      `,
    ` a@1  a~@1 a~@1 b@2 b~@2 b~@2 b~@2 // b~@2 b~@2 a~@1 a~@1 a~@1 a~@1 `,
    ` a@1  a~@1 a~@1 a~@1 b@2 b~@2 b~@2 b~@2 // b~@2 b~@2 a~@1 a~@1 a~@1 `,
    ` a@1  a~@1 a~@1 b@2 b~@2 b~@2 b~@2 // b~@2 b~@2 a~@1 a~@1 a~@1      `,
    ` a@1 a~@1 v a~@1 w a~@1 a~@1 // a~@1 a~@1 v a~@1 w a~@1 a~@1        `,
  ]
    .map(L.align)
    .map(x => (
      <div className="NoManualBlue" style={{display: 'inline-table', marginRight: '40px'}}>
        {x}
      </div>
    ))

  return (
    <div className={ArticleStyle}>
      {intro}
      {alignment()}
      {future}
      <div style={{display: 'flex', flexDirection: 'row', flexWrap: 'wrap'}}>{gallery}</div>
    </div>
  )
}
