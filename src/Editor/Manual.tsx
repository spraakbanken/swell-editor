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

This is an interactive manual.

It consists of a series of examples of fabricated learner texts that illustrate how to use the editor.

There are two windows for text: source text and target hypothesis text.
Showing the source text is toggled by clicking _show source text_.
The text areas can be resized. Try resizing the target hypothesis window so that you can see what is below it.

In the target hypothesis window below you can see the learner text _a example_.
Edit the target hypothesis text below to make it _an example_.

The word pairs _a_ and _an_ will automatically be aligned in the graph under
the target hypothesis window because the words are similar.
  `,
  G.compact_to_graph('a example//an example')
)

page(
  'labelling',
  md`
# Labelling

Under the target hypothesis window you see the linked structure from the learner text (on the top layer) to the
hypothesis text (on the bottom layer). Click on the first link to select it.

When you have a selection you can put labels on it using the menu that appears the right.
You can either write in the label name into the text area or click on the name of the label.
Pick an appropriate label for this error (_O_).
  `,
  G.compact_to_graph('a example//an:O example')
)

page(
  'selections',
  md`
# Selections and browsing between links

When you have a selection you can select the next group with the next and prev buttons.
There are also shortcuts to these which you find by hovering them.
You can also go directly to the next group which has any modifications (skipping pairs
that are the same) by clicking _prev mod_ and _next mod_.

When left-clicking a word the selection for other words remains. Thus if you want to
make a "new" selection you must first deselect. Deselect by clicking outside
the graph. You can also make a new selection by right-clicking on a word. That will
make only that word be selected.
  `,
  G.compact_to_graph(`Their was a problem yesteray .//There:O was a problem yesterday:O .`),
  G.compact_to_graph(`Their was a problem yesteray .//There was a problem yesterday .`)
)

page(
  'compounds',
  md`
# Compound errors

We will now look at a little bit more complicated link structures.

Compound errors (over-compounding and over-splitting) introduce links that are 2-1 and 1-2
(from two source words to one target word, and vice versa.)

Correct the sentence below by changing _highlight_ to _high light_ and _compounderrors_ to _compound errors_ and you will see that you get 2-1 and 1-2 links.

Mark a group to label it. When you put a label on these all three linked words (for example: _highlight_, _high_ and _light_) share the label.
Put labels on both linked groups (_O-COMP_).
  `,
  G.compact_to_graph(`
This example high lights compounderrors .//
This example highlights:O-COMP compound errors:O-COMP .
`)
)

page(
  'group',
  md`
# Making manual link groups

The automatic linking will not work when the words are too dissimilar.

When this happens, click the words you want to group and press group
in the label sidebar. There is also a keyboard shortcut and you see the shortcut
by hovering over the button.

Connect the words _well_ and _good_ below. They are not automatically linked since they have no common letters. The link will become blue to highlight that it is a manual link.
  `,
  G.compact_to_graph(`I see good .//I see well~good .`),
  G.compact_to_graph(`I see good .//I see well .`)
)

page(
  'orphan',
  md`
# Orphan: disconnecting words

Here a linked group has too many members.
We want to put _with_ and _many_ on groups on their own.
Here we cannot select both of them and press _group_ since then they will
be linked to themselves (try it and use then use undo).

Instead select both and press the the _orphan_ button to make each word orphaned: only connected to itself.

(Another alternative is to select the words one by one and press _group_: indeed, with only one word selected _group_ and _orphan_ do the same thing.)
  `,
  G.compact_to_graph(
    `A sentence wery missing words .// A sentence with~ very many~ missing words .`
  ),
  G.compact_to_graph(`A sentence wery missing words .// A sentence with very many missing words .`)
)

page(
  'unlinking',
  md`
# Removing links

In the example below the automatic aligner has aligned _his_ and _where_ (because they share the _h_)
but we want _his_ and _he_ to be aligned.

This can be resolved in three ways:

1.  Select _his_ and _he_ and use _group_.
2.  Select _where_ and use _orphan_.
3.  Select _where_ and use _group_.
  `,
  G.compact_to_graph(`I don't know his lives .//I don't know where he~his lives .`),
  G.compact_to_graph(`I don't know his lives .//I don't know where he lives .`)
)

page(
  'auto',
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
  'revert',
  md`
# Revert

There is normal undo functionality on Ctrl-Z and redo on Ctrl-Y which works with linear history.

Sometimes it is more useful to revert at a specific selection in the graph.
In the example below some changes have been made to the text but we would like to revert them.
Select a changed word and use _revert_. Do this for all changed words.
  `,
  G.compact_to_graph(`A sentence with many words . // A sentence with many words . `),
  G.compact_to_graph(`A sentence with many words . // Sentences with many missing words .`)
)

page(
  'movement',
  md`
# Word movement

Word movement can be tracked by changing the text and then selecting the words and grouping them.
You can do this by erasing the word and then rewriting it or by using standard copy and paste functionality.

A quicker way is to have the cursor on the word and use Alt-n and Alt-p for transposing the word onto the **n**ext and the **p**revious word.
If the cursor is on many words (select many words in the editor by using the mouse or shift and arrow keys) they will be moved in unison.

Try these different approaches to move _was_ and _his son_ into their correct places.
  `,
  G.compact_to_graph(`
    The room very dirty was . He got to clean his son . //
    The room was~was very dirty . He got his~his son~son to clean .
  `)
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

In the demo mode you can toggle between the anonymization view and normalization
view with _enable/disable anonymization view_.
  `,
  G.compact_to_graph(`
Alice and Bob went to Paris . Alice's wallet was stolen . //
Alice:'firstname:female':1 and Bob:'firstname:male':2 went to Paris:city . Alice's:'firstname:female':1:gen wallet was stolen .
`),
  undefined,
  'anonymization'
)
