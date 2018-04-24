import * as React from 'react'
import * as G from '../Graph'
import {md} from '../Slides'
import {VNode} from '../ReactUtils'

type Mode = 'anonymization' | 'normalization'

export interface ManualPage {
  slug: string
  text: VNode
  graph: G.Graph
  target: G.Graph
  mode: Mode
}

export const manual: Record<string, ManualPage> = {}
export const slugs: string[] = []

function page(
  slug: string,
  text: VNode,
  target: G.Graph,
  graph = G.init_from(G.source_texts(target)),
  mode: Mode = 'normalization'
) {
  slugs.push(slug)
  manual[slug] = {slug, text, graph, target, mode}
}

page(
  'manual',
  md`
# Manual

This is the interactive manual.

It consists of a series of examples of fabricated learner texts that illustrate how to use the editor.

Below is the learner text _a example_. Edit the target hypothesis text below to make it _an example_.

The word pairs _a_ and _an_ will automatically be aligned because the words are similar.
  `,
  G.compact_to_graph('a example//an example')
)

page(
  'labelling',
  md`
# Labelling

Below you also see the linked structure from the learner text (on the top layer) to the
hypothesis text (on the bottom layer). Click on the first link to select it.

When you have a selections you can put labels on it using the menu to the right.
You can either write in the label name into the text area or click on the name of the label.
Pick an appropriate label for this error.
  `,
  G.compact_to_graph('a example//an:M-DEF example')
)

page(
  'compounds',
  md`
# Compound errors

We will now look at a little bit more complicated link structures.

Compound errors (over-compounding and over-splitting) introduce links that are 2-1 and 1-2
(from two source words to one target word, and vice versa.)

Correct the sentence below and you will see that you get 2-1 and 1-2 links.

Label the linked groups. When you put a label on these all three words share the label.
  `,
  G.compact_to_graph(`
This example high lights compounderrors .//
This example highlights:O-COMP compound errors:O-COMP .
`)
)

page(
  'links',
  md`
# Making manual links

The automatic linking will not work when the words are too dissimilar.

When this happens, click the words you want to connect and press connect

in the label sidebar. There is also a keyboard shortcut and you see the shortcut
by hovering over the connect button.

Connect the words _well_ and _good_ below. The link will become blue to highlight that it is a manual link.
  `,
  G.compact_to_graph(`I see good .//I see well~good .`),
  G.compact_to_graph(`I see good .//I see well .`)
)

page(
  'unlinking',
  md`
# Removing manual links

In case you get too many manual links you can remove them with the button _auto_
which makes them fall back to the automatic linker. Do so and then make sure _well_ and _good_
are aligned.
  `,
  G.compact_to_graph(`I see good .//I see well~good .`),
  G.compact_to_graph(`I@1 see~@1 good~@1 .~@1//I~@1 see~@1 well~@1 .~@1`)
)

page(
  'isolating',
  md`
# Isolating a group

In the example below the automatic aligned has aligned _his_ and _where_ (because they share the _h_)
but we want _his_ and _he_ to be aligned.

This example illustrates the difference between _isolate_ and _connect_:
If you select _his_ and _he_ and click _connect_ then the word _where_ will also be connected
because it was part of the group before. If you instead choose _isolate_ then the words
_he_ and _his_ will be "isolated" alone in a new group.
  `,
  G.compact_to_graph(`I don't know his lives .//I don't know where he~his lives .`),
  G.compact_to_graph(`I don't know his lives .//I don't know where he lives .`)
)

page(
  'disconnecting',
  md`
# Disconnecting a word

Here a group has too many members. Use the _disconnect_ button to remove _where_ from the group.
  `,
  G.compact_to_graph(`I don't know his lives .//I don't know where he~his lives .`),
  G.compact_to_graph(`I don't know his lives .//I don't know where~his he~his lives .`)
)

page(
  'labels',
  md`
# Adding many labels

When you have a selection you can select the next group with the next and prev buttons.
There are also shortcuts to these which you find by hovering them.
You can also go directly to the next group which has any modifications (skipping pairs
that are the same.)
  `,
  G.compact_to_graph(`Their was a problem yesteray .//There:O was a problem yesterday:O .`),
  G.compact_to_graph(`Their was a problem yesteray .//There was a problem yesterday .`)
)

page(
  'anonymization',
  md`
# Anonymization mode

In anonymization mode there is no target text to edit.
Data about the entities are put directly onto the edge groups.

Each entity needs a unique number. The label editor allows adding numbers besides
the predefined categories of labels. Give Alice number 1 and Bob number 2.
Put other labels as appropriate. Remember that _Alice's_ is in genitive.
  `,
  G.compact_to_graph(`
Alice and Bob went to Paris . Alice's wallet was stolen . //
Alice:'firstname:female':1 and Bob:'firstname:male':2 went to Paris:city . Alice's:'firstname:female':1:gen wallet was stolen .
`),
  undefined,
  'anonymization'
)
