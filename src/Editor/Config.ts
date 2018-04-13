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

const taxonomy = [
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
      {label: 'geo', desc: ''},
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
    ],
  },
  {
    group: 'Mark',
    entries: [{label: 'prof', desc: ''}, {label: 'sensitive', desc: ''}],
  },
]

export const config = {order_changing_labels, examples, image_ws_url, taxonomy}
