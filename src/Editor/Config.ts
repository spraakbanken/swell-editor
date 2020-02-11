import {chain_cmps, mkcmp, cmp_order, Comparator} from '../Utils'

const image_ws_url = 'https://ws.spraakbanken.gu.se/ws/swell'
const pseuws_url = 'https://ws.spraakbanken.gu.se/ws/larka/pseuws'

export interface Example {
  source: string
  target: string
}

const ex = (source: string, target: string): Example => ({source, target})

const examples: Example[] = `
Alice and Bob went to Paris . Alice's wallet was stolen . // Alice:1:'firstname_female' and Bob:2:'firstname_male' went to Paris:3:city . Alice's:1:'firstname_female':gen wallet was stolen .

Their was a problem yesteray . // There was a problem yesterday .

I don't know his lives . // I don't know where he~his lives .

He get to cleaned his son . // He got his~his son~son to:O clean:O the~ room~ .

We wrote down the number . // We wrote the number down~down .
`
  .trim()
  .split(/\n\n+/gm)
  .map(line => ex.apply({}, line.split('//').map(side => side.trim()) as [string, string]))

const order_changing_labels: Record<string, true> = {
  'S-adv': true,
  'S-finV': true,
  'S-WO': true,
  WO: true,
  INV: true,
  OINV: true,
}

export const label_args: Record<string, number> = {
  age_string: 1,
}

export type TaxonomyGroup = {
  group: string
  entries: {
    label: string
    desc: string
  }[]
}

export type Taxonomy = TaxonomyGroup[]

const extra = 'gen def pl foreign'.split(' ')
const temporary = 'OBS! Cit-FL Com!'.split(' ')
const digits = /^\d+$/

/** An ordered set of label categories. */
export enum LabelOrder {
  BASE,
  NUM,
  EXTRA,
  TEMP,
}

/** Maps a label to a category in LabelOrder. */
export function label_order(label: string): LabelOrder {
  if (temporary.includes(label)) {
    return LabelOrder.TEMP
  } else if (extra.includes(label)) {
    return LabelOrder.EXTRA
  } else if (digits.test(label)) {
    return LabelOrder.NUM
  } else {
    return LabelOrder.BASE
  }
}

/** Sorting function for labels. */
// Sort first by taxonomy, then label type, and finally alphabetically.
export const label_sort: Comparator<string> = chain_cmps(
  mkcmp(label_taxonomy),
  mkcmp(label_order),
  cmp_order
)

const anonymization: Taxonomy = [
  {
    group: 'Morphology',
    entries: [
      {label: 'gen', desc: 'genitive'},
      {label: 'def', desc: 'definite'},
      {label: 'pl', desc: 'plural'},
    ],
  },
  {
    group: 'Names',
    entries: [
      {label: 'firstname_male', desc: ''},
      {label: 'firstname_female', desc: ''},
      {label: 'firstname_unknown', desc: ''},
      {label: 'surname', desc: ''},
      {label: 'middlename', desc: ''},
      {label: 'initials', desc: ''},
    ],
  },
  {
    group: 'Geographic data',
    entries: [
      {label: 'country', desc: 'except Sweden'},
      {label: 'zip_code', desc: ''},
      {label: 'region', desc: ''},
      {label: 'foreign', desc: ''},
      {label: 'city', desc: 'city including villages'},
      {label: 'area', desc: ''},
      {label: 'place', desc: ''},
      {label: 'geo', desc: 'forest, lake, mountain, etc'},
      {label: 'street_nr', desc: 'street number'},
    ],
  },
  {
    group: 'Institutions',
    entries: [
      {label: 'school', desc: ''},
      {label: 'work', desc: ''},
      {label: 'other_institution', desc: ''},
    ],
  },
  {
    group: 'Transportation',
    entries: [
      {label: 'transport_name', desc: 'bus, metro, tram, train, express'},
      {label: 'transport_nr', desc: 'number, color'},
    ],
  },
  {
    group: 'Age',
    entries: [{label: 'age_digits', desc: ''}, {label: 'age_string', desc: ''}],
  },
  {
    group: 'Dates',
    entries: [
      {label: 'day', desc: ''},
      {label: 'month_digit', desc: ''},
      {label: 'month_word', desc: ''},
      {label: 'year', desc: ''},
      {label: 'date_digits', desc: 'numerical date represenation, delimiters are retained'},
    ],
  },
  {
    group: 'Misc',
    entries: [
      {label: 'phone_nr', desc: ''},
      {label: 'email', desc: ''},
      {label: 'personid_nr', desc: ''},
      {label: 'account_nr', desc: ''},
      {label: 'license_nr', desc: ''},
      {label: 'other_nr_seq', desc: 'a sequence of numbers'},
      {label: 'url', desc: ''},
      {label: 'extra', desc: ''},
    ],
  },
  {
    group: 'Mark',
    entries: [
      {label: 'prof', desc: 'profession'},
      {label: 'edu', desc: 'education, courses'},
      {label: 'fam', desc: 'family members'},
      {label: 'sensitive', desc: ''},
    ],
  },
  {
    group: 'Other',
    entries: [
      {label: 'Cit-FL', desc: 'Citation for a language'},
      {label: 'Com!', desc: 'Comment'},
      {label: 'OBS!', desc: 'Attention'},
    ],
  },
]

export const normalization: Taxonomy = [
  {
    group: 'Other',
    entries: [
      {
        label: 'Cit-FL',
        desc: 'Citation for a language'
  },
  {
        label: 'Com!',
        desc: 'Comment'
      },
      {
        label: 'OBS!',
        desc: 'Attention'
      },
      {
        label: 'X',
        desc: 'Impossible to interpret the writer’s intention',
      },
    ],
  },
]

// Julia's updated taxonomy 19 April 2018
export const correctannot: Taxonomy = [
  {
    group: 'Orthographic',
    entries: [
      {
        label: 'O',
        desc: 'Orthographic/spelling error',
      },
      {
        label: 'O-Cap',
        desc: 'Error with capitalization (upper/lower)',
      },
      {
        label: 'O-Comp',
        desc: 'Error within compounds (oversplitting, overcompounding)',
      },
    ],
  },
  {
    group: 'Lexical',
    entries: [
      {
        label: 'L-Der',
        desc: 'Deviant (existisng!) derivational affix used',
      },
      {
        label: 'L-FL',
        desc: 'Foreign word (not conventionally used in Swedish)',
      },
      {
        label: 'L-Ref',
        desc: 'Reference error',
      },
      {
        label: 'L-W',
        desc:
          'Wrong content word/phrase. Includes even phrasal verbs, reflexives with missing particle/reflexive marker, and multiword prepositions.',
      },
    ],
  },
  {
    group: 'Morphological',
    entries: [
      {
        label: 'M-Adj/adv',
        desc: 'Corrections concerning the confusions of adjective and adverbial endings',
      },
      {
        label: 'M-Case',
        desc: 'Corrections regarding the use of genitive (nouns) and dative forms (pronouns)',
      },
      {label: 'M-Def', desc: 'Deviation in definite/indefinite forms'},
      {label: 'M-F', desc: 'Deviant paradigm selection, but correct grammatical category'},
      {label: 'M-Gend', desc: 'Correction regarding grammatical gender'},
      {label: 'M-Num', desc: 'Deviation in number agreement. May apply to groups of words'},
      {
        label: 'M-Other',
        desc:
          'Ambiguous cases with several possible target hypotheses – to be applied when there are no convincing arguments for any other morphological code',
      },
      {label: 'M-Verb', desc: 'Covers deviations in the verb phrase, i.e. aspect, tense, mode'},
    ],
  },
  {
    group: 'Punctuation',
    entries: [
      {
        label: 'P-M',
        desc: 'Missing punctuation',
      },
      {
        label: 'P-R',
        desc: 'Redundant punctuation',
      },
      {
        label: 'P-Sent',
        desc: 'Merging, or splitting a sentence',
      },
      {
        label: 'P-W',
        desc: 'Wrong punctuation',
      },
    ],
  },
  {
    group: 'Syntactical',
    entries: [
      {
        label: 'S-Adv',
        desc: 'Word order error involving adverbial placement',
      },
      {
        label: 'S-Comp',
        desc: 'Problematic syntactical construction',
      },
      {
        label: 'S-FinV',
        desc: 'Word order error with finite verb placement',
      },
      {
        label: 'S-M',
        desc:
          'Grammatical word missing, e.g. particle, reflexive pronoun, connector, auxiliary verbs',
      },
      {
        label: 'S-Msubj',
        desc: 'Subject missing',
      },
      {
        label: 'S-Other',
        desc:
          'Wrong function word, e.g. preposition (also multiword presposition), auxilary verb; particle and reflexive marker.',
      },
      {
        label: 'S-R',
        desc: 'Word or phrase redundant',
      },
      {
        label: 'S-WO',
        desc: 'Word or phrase order – other',
      },
    ],
  },
  {
    group: 'Other',
    entries: [
      {
        label: 'C',
        desc: 'Consistence',
      },
      {
        label: 'Cit-FL',
        desc: 'Citation for a language',
      },
      {
        label: 'Com!',
        desc: 'Comment'
      },
      {
        label: 'OBS!',
        desc: 'Attention'
      },
      {
        label: 'Unid',
        desc: 'Error that cannot be categorized according to other codes',
      },
      {
        label: 'X',
        desc: 'Impossible to interpret the writer’s intention',
      },
    ],
  },
]

function doc_url(title: string): string {
  return 'https://spraakbanken.github.io/swell-project/' + title
}

const docs: Record<string, Record<string, string>> = {
  anonymization: {
    'pseudonymization guidelines': doc_url('Anonymization_guidelines'),
  },
  normalization: {
    'normalization guidelines': doc_url('Normalization_guidelines'),
  },
  correctannot: {
    'annotation guidelines': doc_url('Correction-annotation_guidelines-and-codebook'),
  },
}

export const config = {
  order_changing_labels,
  examples,
  image_ws_url,
  pseuws_url,
  taxonomy: {anonymization, normalization, correctannot},
  docs,
}

/** What group does this label belong to?

  (label_group('country') as TaxonomyGroup).group // => 'Geographic data'
  label_group('quux') // => undefined

 */
export function label_group(label: string): TaxonomyGroup | undefined {
  return config.taxonomy.anonymization.find(
    group => !!group.entries.find(entry => entry.label == label)
  )
}

export interface TaxonomyFind {
  taxonomy: string
  group: string
  entry: {label: string; desc: string}
}

export function find_label(label: string): TaxonomyFind | undefined {
  const order = label_order(label)
  if (order === LabelOrder.NUM) {
    return {taxonomy: 'anonymization', group: 'Number', entry: {label, desc: 'number'}}
  }
  if (order === LabelOrder.TEMP) {
    return undefined
  }
  for (let taxonomy in config.taxonomy) {
    for (let group of (config.taxonomy as {[mode: string]: Taxonomy})[taxonomy]) {
      let entry = group.entries.find(entry => entry.label == label)
      if (entry !== undefined) return {taxonomy, group: group.group, entry}
    }
  }
}

/** Get the taxonomy domain (editor mode) of a label. */
export function label_taxonomy(label: string): string | null {
  return find_label(label) ? find_label(label)!.taxonomy : null
}

/** Does the named taxonomy include the given label? */
export function taxonomy_has_label(taxonomy: string, label: string): boolean {
  if (!(taxonomy in config.taxonomy)) return false
  const tax: Record<string, TaxonomyGroup[]> = config.taxonomy
  return !!tax[taxonomy].find(g => !!g.entries.find(l => l.label == label))
}
