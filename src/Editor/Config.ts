const image_ws_url = 'https://ws.spraakbanken.gu.se/ws/swell'

export interface Example {
  source: string
  target: string
}

const ex = (source: string, target: string): Example => ({source, target})

const examples: Example[] = `
Alice and Bob went to Paris . Alice's wallet was stolen . // Alice:1:firstname:female:nom and Bob:2:firstname:male:nom went to Paris:city . Alice's:1:firstname:female:gen wallet was stolen .

Their was a problem yesteray . // There was a problem yesterday .

The team that hits the most runs get ice cream . // The team that hits the most runs gets ice cream .

Blue birds have blue and pink feathers . // Bluebirds have blue and pink feathers .

I don't know his lives . // I don't know where he~his lives .

He get to cleaned his son . // He got his~his son~son to:O clean:O the~ room~ .

We wrote down the number . // We wrote the number down~down .

English is my second language with many difficulties that I faced them in
twolast years I moved in United States .
//

In my homeland we didn’t write as structural as here .
//

During the semester , I frustrated many times with my grades and thought I
couldn’t go up any more , because there was a very big difference between
ESOL 40 with other language people .
//

Sometimes , I recognized about why I’m here and studying with this crazy
language that I couldn’t be good at all .
//

In contrast I faced with my beliefs and challenges that helped me to focus
on my mind to write an essay with these difficult subjectswith no experience
as narrative essay , business essay and all argumentative essays .
//

It makes me proud of myself to write something I never thought I can do
in end of this semester and improve my writing skills , have learned my
challenges and discovered strategies to overcome the challenges .
//
`
  .trim()
  .split(/\n\n+/gm)
  .map(line => ex.apply({}, line.split('//').map(side => side.trim())))

const order_changing_labels: Record<string, true> = {
  O: true,
  WO: true,
  INV: true,
  OINV: true,
}

export type Taxonomy = {
  group: string
  entries: {
    label: string
    desc: string
  }[]
}[]

const anonymization = [
  {
    group: 'Names',
    entries: [
      {label: 'surname', desc: ''},
      {label: 'firstname', desc: ''},
      {label: 'middlename', desc: ''},
      {label: 'male', desc: ''},
      {label: 'female', desc: ''},
      {label: 'unknown', desc: ''},
    ],
  },
  {
    group: 'Morphology',
    entries: [{label: 'gen', desc: ''}, {label: 'nom', desc: ''}],
  },
  {
    group: 'Errors',
    entries: [{label: 'ort', desc: ''}],
  },
  {
    group: 'Institutions',
    entries: [{label: 'institution', desc: ''}],
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
      {label: 'street', desc: ''},
      {label: 'geo', desc: 'forest, lake, mountain, etc'},
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
    entries: [{label: 'age', desc: ''}],
  },
  {
    group: 'Dates',
    entries: [
      {label: 'day', desc: ''},
      {label: 'month-digit', desc: ''},
      {label: 'month-word', desc: ''},
      {label: 'year', desc: ''},
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
      {label: 'url', desc: ''},
      {label: 'extra', desc: ''},
    ],
  },
  {
    group: 'Mark',
    entries: [{label: 'prof', desc: ''}, {label: 'sensitive', desc: ''}],
  },
]

// Julia's updated taxonomy 19 April 2018
export const normalization: Taxonomy = [
  {
    group: 'Lexical',
    entries: [
      {
        label: 'L',
        desc: 'Wrong word',
      },
      {
        label: 'L-REF',
        desc: 'Reference error',
      },
      {
        label: 'L-DER',
        desc: 'Deviant derivational affix used',
      },
      {
        label: 'L-ID',
        desc: 'Idiomaticity',
      },
      {
        label: 'L-FL',
        desc: 'Non-Swedish word',
      },
    ],
  },
  {
    group: 'Orthographic',
    entries: [
      {
        label: 'O',
        desc: 'Orthographic / spelling error',
      },
      {
        label: 'O-CAP',
        desc: 'Error with capitalization (upper / lower)',
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
        label: 'M-F',
        desc: 'Deviant morphosyntactic category',
      },
      {
        label: 'M-DEF',
        desc: 'Deviation in definite/indefinite forms,',
      },
      {
        label: 'M-NUM',
        desc: 'Deviation in number agreement',
      },
      {
        label: 'M-GEN',
        desc: 'gender error ',
      },
      {
        label: 'M-AGR',
        desc: '? Note! This code need to be tested whether we should keep it.',
      },
      {
        label: 'M-INFL',
        desc:
          'Deviant paradigm selection, but interpreted to be in accordance with a morpho-syntactic form in Swedish; overgeneralization',
      },
      {
        label: 'M-VERB',
        desc: 'Covers all deviations with verbs and verb groups, incl aspect',
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
        desc: 'Word, phrase missing',
      },
      {
        label: 'S-R',
        desc: 'Word or phrase redundant',
      },
      {
        label: 'S-adv',
        desc: 'Word order error with adverbial placement',
      },
      {
        label: 'S-finV',
        desc: 'Word order error with finite verb placement',
      },
      {
        label: 'S-WO',
        desc: 'Word or phrase order - other',
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
        desc: 'impossible to interpret the writer’s intention ',
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

export const config = {
  order_changing_labels,
  examples,
  image_ws_url,
  taxonomy: {anonymization, normalization},
}
