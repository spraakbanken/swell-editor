import * as record from './record'

import * as R from 'ramda'
import * as React from 'react'
import {Store} from 'reactive-lens'
import {style, types} from 'typestyle'
import * as csstips from 'csstips'
import * as D from './Diff'
import * as G from './Graph'
import * as L from './LadderView'
import * as C from './Compact'

import * as RD from './RichDiff'
import * as T from './Token'
import * as Utils from './Utils'

import {VNode} from './ReactUtils'

import {md} from './Slides'

export interface State {
  only?: number
}

export const init: State = {
  only: undefined,
}

export function App(store: Store<State>): () => VNode {
  ;(window as any).store = store
  return () => View(store.get())
}

const ArticleStyle = style(Utils.debugName('ArticleStyle'), {
  boxSizing: 'border-box',
  minWidth: '200px',
  maxWidth: '980px',
  margin: '0 auto',
  color: '#24292e',
  fontFamily:
    'Lato, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
  lineHeight: 1.5,
  wordWrap: 'break-word',
  $nest: {
    '&:not(.only)': {
      padding: '45px',
    },
    '& .SmallLadder .upper': {
      height: '14px',
    },
    '& .SmallLadder .mid, & .SmallLadder .lower': {
      height: '8px',
    },
    '& .SmallLadder li:last-child': {
      marginTop: '-2px',
    },
    '& .equidistant ul': {
      width: '12px',
    },
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
  function make_example(s: string, t: string) {
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
  const wo = ' always'

  const full = make_example(s, t)
  const wo_always = make_example(s.replace(wo, ''), t.replace(wo, ''))

  return md`

    ## Alignment procedure

    Initially we start with the target being equal to the source:

    ${ladder(full.g0)}

    We want to edit the target text as if it were in an input text box, without
    considering that the tokens in the text is part of a linked structure.

    If we edit the target text, by manually insterting and deleting characters, the program? gives us

    ${ladder(full.g)}

    These alignments are all correct except for the word order movement.
    How was this calculated?
    Start with a standard diff edit script on the _character-level_:

    ${ladder(full.g_unlab, 'equidistant')}

    We calculate this using Myers' diff algorithm provided by the
    [diff-match-patch](https://github.com/google/diff-match-patch) library.
    Each character is identified with the token it originated from.
    These character level alignments are now lifted to the token level.
    Spaces are not used for alignment due to giving rise to too many
    false positives.

    We can now read off from this which tokens should be aligned, namely these six groups:

    | group | source words | target words |
    | ---   | ---          | ---          |
    | 1     | Examples     | Examples     |
    | 2     |              | always       |
    | 3     | high light   | highlight    |
    | 4     | lotsof       | lots of      |
    | 5     | futures      | features     |
    | 6     | always       |              |

    Writing parallell corpora this way is sometimes called standoff and is used in tools like Falco.

    ### Manual alignment: for word order changes or when the automatic alignment makes mistakes

    The user could conceivable correct aligments in many ways, including:

    1. _preemptively_ by manually moving the word by drag and drop in the graph (or similar techniques)
    2. _as a fix-up stage_ adding a link by merging two links, using the mouse in the graph

    In our editor only the second alternative is implemented since doing many operations of drag and drop
    is tiring for the user (and also from a testing perspective for the editor developer).
    So the user selects the two always and indicates to the editor that these should be manually
    aligned. We are now in a stage where part of the parallell sentences have
    one manual alignment regarding the word _always_. Other words are not yet considered aligned since
    each alignment round starts from scratch (again, excluding the manually assigned links).
    To get the remaining alignments, the plan is to do the same procedure as before
    but excluding the manually aligned _always_: we will first _remove_ manually aligned words,
    then align the rest of the text automatically, and then _insert_ the manually aligned words again in their correct position.
    Here the correct position is where they where removed from from the respective texts.

    We thus proceed by removing that word and aligning the rest of the text automatically to get this:

    ${ladder(wo_always.g_unlab, 'equidistant')}

    We now read off the aligments to get:

    ${ladder(wo_always.g)}

    We can now insert the missing words into their correct places based on position in the respective sentences
    to get the desired alignment:

    ${Align(
      'Examples high light lotsof futures always',
      'Examples always~always highlight lots of features'
    )}

    The editor indicates that this is a edge is manual colouring it blue.
    These edges interact with other edges differently from the automatically aligned
    grey edges, exactly how this works is explained in the next section.

    ## Editing in the presence of manual and automatic alignments

    The tokens that have been manually aligned are remembered (by the editor?). The user may now go on editing
    the target hypothesis. For the editor, things are straight-forward as long as the
    edit is wholly in an automatically aligned section or a in a manually aligned section. When
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

    In case the manual aligner has absorbed too much, our editor provides a way to
    untag the manually aligned, to make
    it fall back to the automatic aligner.
    `
}

export function View(state: State): VNode {
  const intro = md`
    # Mostly Automatic Word Alignment of Parallel Corpora

    _Dan Rosén dan.rosen@svenska.gu.se 2018_

    An error-corrected learner text can be seen as a parallel corpus from
    the source text written by the learner to the target hypothesis text.
    We would like precise word alignments between these two texts and motivated
    by this develop an editor which aligns these automatically and lets the user manually
    link the (unevitable) mistakes from the automatic alignment. We note
    that the situation is not exclusive to learner corpora and could be
    viable between other language pairs given that they are similar enough,
    for example the Scandinavian languages but for the purposes of this
    article we focus on learner corpora.

    Here is a hypothetical sentence from such a word aligned parallel learner corpus:

    ${Align(
      'Examples high light lotsof futures always',
      'Examples always~always highlight lots of features',
      'NoManualBlue'
    )}

    This example also illustrates the features of our representation
    of aligned sentences. Directly we see that the misspelled or wrongly chosen
    word _futures_ is linked with the hypothesis target word _features_.
    Moreover, we can represent many-to-one alignments, useful for undercompounding, in the
    example of _high light_ to _highlight_.
    Conversely, one-to-many alignments in the case of overcompounding are expressible
    and is used to represent the link from _lotsof_ to _lots of_.
    Finally, word movement are tracked as in the case of the moved word _always_ from the end of the sentence towards the beginning.

    We want to point out that it is the presence of these operations such as
    over- and undercompounding and word movement that make traditional
    token-based annotations such as stand-off unsuitable for learner corpora.
    This approach was taken in eg MERLIN (Boyd et al) using the editors FALKO (check this ?).

    An alternative approach was taken in ASK (Tenfjord et al) where segments from the learner texts
    were noted and replaced with one single xml tag. Nested xml tags are supported.
    We see two drawbacks of this approach:
    1. long word movements require all intermediate tokens to be annotated, which is an over-approximation
    2. editing an xml text directly is unnatural

    The work closest to this is the Czech learner corporus CzeSL (Hana, Rosen, et al)
    and its parallel corpora editor feat.
    The main difference is that our editor suggests edge alignments automatically.
    In feat all edges are placed manually (I think?) and
    there is also more freedom in how to put edges in this editor (I think?).
    It supports several layers of hypothesis and the corpora utilizes the first
    layer to provide a lexically correct hypothesis while the last layer also
    corrects morphological agreements and word order rearrangements. There is
    also a possibility to use secondary edges to indicate agreement dependencies.
    These two extensions remain further work for our editor.

    In our editor the user instead edits the target hypothesis and it is aligned
    automatically to the learner text using standard diff edit script calculations.
    Only word-movements need to be explicitly marked and in the (relatively rare, we anticipate)
    cases where the automatic aligned incorrectly links words.

    ### Annotations

    A natural place to put annotations is on the edges of these:

    ${Align(
      "Examples high light:undercompound lotsof:overcompound futures:'ortography||word choice' always:'word order'",
      'Examples always~always highlight lots~lotsof of~lotsof features',
      'NoManualBlue',
      false
    )}

    We will not focus more on such labels in this text but simply highlight
    that this is a possibility.
  `

  const alignment_text = alignment()

  const future = md`
    ## Future work

    Automatic alignment could be based on something else than character-level diffs. A
    token-based diff could be used, where the distance between tokens are
    calculated between word embeddings in a shared embedding space for the
    two languages. Producing word aligned parallel corpora could then also
    become _mostly automatic_.

    As for the visualisation, the pictures may be rotated 90 degrees to
    facilitate work with sentence-aligned parallell corpora.

    ## Gallery
  `

  const gallery = [
    ` aa bb      // bb cc            `,
    ` bb cc      // aa bb            `,
    ` a b       // b a~a             `,
    ` a b       // b~b a             `,
    ` b a       // a b~b             `,
    ` b a       // a~a b             `,
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
  ].map(s => <div style={{display: 'inline-table', marginRight: '40px'}}>{align(s)}</div>)

  const only = state.only

  if (only !== undefined) {
    return <div className={ArticleStyle + ' only'}>{Ladders[only]}</div>
  } else {
    return (
      <div className={ArticleStyle}>
        {intro}
        {alignment_text}
        {future}
        <div style={{display: 'flex', flexDirection: 'row', flexWrap: 'wrap'}}>{gallery}</div>
      </div>
    )
  }
}

const Ladders = [] as VNode[]

export function ladder(g: G.Graph, more_classes = '', SmallLadder = true): VNode {
  const vn = (
    <div
      className={('NoPixelPerfect ' + (SmallLadder ? 'SmallLadder ' : '') + more_classes).trim()}>
      {L.ladder(g)}
    </div>
  )
  Ladders.push(vn)
  return vn
}

export function Align(source: string, target: string, more_classes = '', SmallLadder = true) {
  const s = C.parse(source)
  const t = C.parse(target)
  return ladder(C.units_to_graph(s, t), more_classes, SmallLadder)
}

export function align(x: string) {
  const [source, target] = x.split('//')
  const s = C.parse(source)
  const t = C.parse(target)
  return ladder(C.units_to_graph(s, t), 'NoManualBlue')
}
