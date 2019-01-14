import {chain_cmps, mkcmp, cmp_order, Comparator} from '../Utils'

const image_ws_url = 'https://ws.spraakbanken.gu.se/ws/swell'

export interface Example {
  source: string
  target: string
}

const ex = (source: string, target: string): Example => ({source, target})

const examples: Example[] = `
Alice and Bob went to Paris . Alice's wallet was stolen . // Alice:1:'firstname:female' and Bob:2:'firstname:male' went to Paris:city . Alice's:1:'firstname:female':gen wallet was stolen .

Their was a problem yesteray . // There was a problem yesterday .

I don't know his lives . // I don't know where he~his lives .

He get to cleaned his son . // He got his~his son~son to:O clean:O the~ room~ .

We wrote down the number . // We wrote the number down~down .
`
  .trim()
  .split(/\n\n+/gm)
  .map(line => ex.apply({}, line.split('//').map(side => side.trim())))

const order_changing_labels: Record<string, true> = {
  'S-adv': true,
  'S-finV': true,
  'S-WO': true,
  WO: true,
  INV: true,
  OINV: true,
}

export type TaxonomyGroup = {
  group: string
  entries: {
    label: string
    desc: string
  }[]
}

export type Taxonomy = TaxonomyGroup[]

const extra = 'gen def pl'.split(' ')
const temporary = 'OBS!'.split(' ')
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
      {label: 'firstname:male', desc: ''},
      {label: 'firstname:female', desc: ''},
      {label: 'firstname:unknown', desc: ''},
      {label: 'surname', desc: ''},
      {label: 'middlename', desc: ''},
      {label: 'initials', desc: ''},
    ],
  },
  {
    group: 'Geographic data',
    entries: [
      {label: 'country_of_origin', desc: ''},
      {label: 'country', desc: 'except Sweden'},
      {label: 'zip_code', desc: ''},
      {label: 'region', desc: ''},
      {label: 'city-SWE', desc: ''},
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
      {label: 'institution', desc: ''},
      {label: 'school', desc: ''},
      {label: 'work', desc: ''},
      {label: 'other_institution', desc: ''},
    ],
  },
  {
    group: 'Transportation',
    entries: [
      {label: 'transport', desc: 'bus, metro, tram, train, express'},
      {label: 'transport_line', desc: 'number, color'},
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
      {label: 'month-digit', desc: ''},
      {label: 'month-word', desc: ''},
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
      {label: 'sensitive', desc: ''},
      {label: 'OBS!', desc: 'Attention'},
    ],
  },
]

export const normalization: Taxonomy = [
  {
    group: 'Unidentified',
    entries: [
      {
        label: 'Uni',
        desc: 'Error that cannot be categorized according to other codes',
      },
      {label: 'OBS!', desc: 'Attention'},
    ],
  },
]

// Julia's updated taxonomy 19 April 2018
export const correctannot: Taxonomy = [
  {
    group: 'Lexical',
    entries: [
      {
        label: 'L',
        desc:
          'Wrong word or phrase. Includes even phrasal verbs and reflexives with missing particle/reflexive marker',
      },
      {
        label: 'L-M',
        desc: 'Missing content word',
      },
      {
        label: 'L-REF',
        desc: 'Reference error',
      },
      {
        label: 'L-DER',
        desc: 'Deviant (existisng!) derivational affix used',
      },
      {
        label: 'L-ID',
        desc: 'Idiomaticity',
      },
      {
        label: 'L-FL',
        desc: 'Foreign word (not conventionally used in Swedish)',
      },
    ],
  },
  {
    group: 'Orthographic',
    entries: [
      {
        label: 'O',
        desc: 'Orthographic/spelling error',
      },
      {
        label: 'O-CAP',
        desc: 'Error with capitalization (upper/lower)',
      },
      {
        label: 'O-COMP',
        desc: 'Error within compounds (oversplitting, overcompounding)',
      },
    ],
  },
  {
    group: 'Morphological',
    entries: [
      {
        label: 'M-CASE',
        desc: 'Corrections regarding the use of genitive (nouns) and dative forms (pronouns)',
      },
      {label: 'M-DEF', desc: 'Deviation in definite/indefinite forms'},
      {label: 'M-GEND', desc: 'Correction regarding grammatical gender'},
      {label: 'M-NUM', desc: 'Deviation in number agreement. May apply to groups of words'},
      {label: 'M-VERB', desc: 'Covers deviations in the verb phrase, i.e. aspect, tense, mode'},
      {label: 'M-F', desc: 'Deviant paradigm selection, but correct grammatical category'},
      {
        label: 'M-ADJ/ADV',
        desc: 'Corrections concerning the confusions of adjective and adverbial endings',
      },
      {
        label: 'M-Other',
        desc:
          'Ambiguous cases with several possible target hypotheses – to be applied when there are no convincing arguments for any other morphological code',
      },
    ],
  },
  {
    group: 'Syntactical',
    entries: [
      {
        label: 'S-Msubj',
        desc: 'Subject missing',
      },
      {
        label: 'S-M',
        desc:
          'Grammatical word missing, e.g. particle, reflexive pronoun, connector, auxiliary verbs',
      },
      {
        label: 'S-R',
        desc: 'Word or phrase redundant',
      },
      {
        label: 'S-adv',
        desc: 'Word order error involving adverbial placement',
      },
      {
        label: 'S-finV',
        desc: 'Word order error with finite verb placement',
      },
      {
        label: 'S-WO',
        desc: 'Word or phrase order – other',
      },
    ],
  },
  {
    group: 'Punctuation',
    entries: [
      {
        label: 'P-W',
        desc: 'Wrong punctuation',
      },
      {
        label: 'P-R',
        desc: 'Redundant punctuation',
      },
      {
        label: 'P-M',
        desc: 'Missing punctuation',
      },
      {
        label: 'Sent-Segmentation',
        desc: 'Merging, or splitting a sentence',
      },
    ],
  },
  {
    group: 'Intelligibility',
    entries: [
      {
        label: 'X',
        desc: 'Impossible to interpret the writer’s intention',
      },
    ],
  },
  {
    group: 'Follow-up correction ',
    entries: [
      {
        label: 'C',
        desc: 'Consistence',
      },
    ],
  },
  {
    group: 'Unidentified',
    entries: [
      {
        label: 'Uni',
        desc: 'Error that cannot be categorized according to other codes',
      },
      {label: 'OBS!', desc: 'Attention'},
    ],
  },
]

const november_2017_pilot_taxonomy: Taxonomy = [
  {
    group: 'Lexical',
    entries: [
      {label: 'W', desc: 'Wrong word or punctuation'},
      {label: 'W-REF', desc: 'Reference error'},
      {label: 'ORT', desc: 'Orthographic/spelling error'},
      {label: 'PART', desc: 'Overcompounding'},
      {label: 'SPL', desc: 'Oversplitting'},
      {label: 'DER', desc: 'Deviant derivational affix used'},
      {label: 'CAP', desc: 'Deviant letter case (upper/lower)'},
      {label: 'ID', desc: 'Idiomaticity'},
      {label: 'FL', desc: 'Non-Swedish word'},
    ],
  },
  {
    group: 'Morphological',
    entries: [
      {label: 'F', desc: 'Deviant selection of morphosyntactic category'},
      {label: 'F-DEF', desc: 'Deviation in definite/indefinite forms'},
      {label: 'F-TENSE', desc: 'Covers all deviations with verbs and verb groups, incl aspect'},
      {label: 'F-NUM', desc: 'Deviation in number agreement'},
      {label: 'F-AGR', desc: 'Agreement error (kongruensfel)'},
      {label: 'INFL', desc: 'Deviant paradigm selection; overgeneralization'},
    ],
  },
  {
    group: 'Syntactical',
    entries: [
      {label: 'M', desc: 'Word, phrase or punctuation missing'},
      {label: 'M-SUBJ', desc: 'Subject missing'},
      {label: 'R', desc: 'Word or phrase redundant'},
      {label: 'R-PREP', desc: 'Preposition redundant'},
      {label: 'R-PUNC', desc: 'Punctuation mark redundant'},
      {label: 'O', desc: 'Word or phrase order'},
      {label: 'INV', desc: 'Non-application of subject/verb inversion '},
      {label: 'OINV', desc: 'Application of subject/verb inversion in inappropriate contexts'},
      {label: 'MCA', desc: 'Incorrect position for main clause adverbial'},
      {label: 'SCA', desc: 'Incorrect position for subsidiary clause adverbial'},
    ],
  },
  {
    group: 'Intelligibility',
    entries: [{label: 'X', desc: "impossible to interpret writer's intention"}],
  },
  {
    group: 'Agreement',
    entries: [{label: 'AGR', desc: 'Agreement errors'}],
  },
]

function doc_url(title: string): string {
  return 'https://spraakbanken.github.io/swell-project/' + title
}

const docs: Record<string, Record<string, string>> = {
  anonymization: {
    'anonymization guidelines': doc_url('Anonymization_guidelines'),
  },
  normalization: {
    'annotation guidelines': doc_url(
      'SweLL correction annotation_guidelines and code book (SweLL-taxonomy)'
    ),
  },
}

export const config = {
  order_changing_labels,
  examples,
  image_ws_url,
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
  if (!isNaN(Number(label))) {
    return {taxonomy: 'anonymization', group: 'Number', entry: {label, desc: 'number'}}
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
