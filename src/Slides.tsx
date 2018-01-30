import * as R from 'ramda'
import * as React from 'react'
import {Store} from 'reactive-lens'
import {style, types} from 'typestyle'
import * as csstips from 'csstips'

import * as D from './Diff'
import * as G from './Graph'
import * as L from './LadderView'
import * as RD from './RichDiff'
import * as T from './Token'
import * as Utils from './Utils'

import {VNode} from './LadderView'

declare var require: any
const Remarkable = require('remarkable')
const remarkable = new Remarkable({linkify: true, typographer: true})

function md(snippets: TemplateStringsArray, ...vnodes: VNode[]): VNode {
  const init_spaces = (snippets[0].match(/^[^\n\S]*(?=\S)/m) || [''])[0]
  const drop = (s: string) =>
    s
      .split(/\n/)
      .map(line => line.slice(init_spaces.length))
      .join('\n')
  const render = (s: string) => ({__html: remarkable.render(drop(s))})
  const out = [] as VNode[]
  for (let i = 0; i < vnodes.length; i++) {
    out.push(<div key={'snip' + i} dangerouslySetInnerHTML={render(snippets[i])} />)
    out.push(vnodes[i])
  }
  if (snippets.length > vnodes.length) {
    out.push(<div key="last" dangerouslySetInnerHTML={render(snippets[vnodes.length])} />)
  }
  return <div className="md">{out}</div>
}

export interface State {
  readonly slide: number
}

export const init: State = {
  slide: 0,
}

function html_rem_aspect_ratio(ratio: number = 16 / 10) {
  const html = document.getElementsByTagName('html')[0]
  const root = {height: html.offsetHeight, width: html.offsetWidth}
  const w = root.width / ratio
  const h = Math.min(root.height, w)
  const fontSize = (h / 20).toString() + 'px'
  html.style.fontSize = fontSize
}

export function App(store: Store<State>): () => VNode {
  const global = window as any
  global.store = store
  global.reset = () => store.set(init)
  global.G = G
  store.storage_connect('swell-slides')

  window.addEventListener('resize', () => html_rem_aspect_ratio(), true)
  html_rem_aspect_ratio()
  window.setTimeout(() => html_rem_aspect_ratio(), 1)

  return () => View(store)
}

const SlideStyle = style(
  {$debugName: 'SlideStyle'},
  {
    outline: 'none',
    width: '32rem',
    height: '20rem',
    margin: 'auto',
    padding: '0 1rem',
    borderBottom: '0.1em brown dotted',
    boxSizing: 'border-box',
  },
  {
    $nest: {
      '& *, & *:after, & *:before': {
        boxSizing: 'border-box',
      },
      '& pre, & code': {
        fontFamily: 'monospace',
      },
      '& *': {
        fontFamily: 'Lato, sans-serif',
        lineHeight: 1.5,
      },
      '& h1, & h2, & h3, & h4, & h5': {
        margin: 0,
      },
    },
  }
)

export function View(store: Store<State>): VNode {
  const state = store.get()
  const slides = [] as VNode[]
  const slide = (v: VNode) => slides.push(v)
  const ladder = () => L.Ladder(G.rearrange(G.init('hej du din lille torsk ! '), 0, 0, 4))
  slide(md`
    # Annoteringspiloten i november
    * 9 texter annoterades
    * 1-4 forskare per text
    * återkoppling muntligt och skriftligt
    * resultatet används som underlag för
      - vidareutveckling av verktyget
      - uppdatera kodboken
      - insikt om vad det är för korpus vi bygger
    ${(
      <div>
        <img src={require('../talk/hws/logo_gu.png')} />
        <img style={{float: 'right'}} src={require('../talk/hws/logo_sb.jpg')} />
      </div>
    )}
  `)
  slide(md`
    # Återkoppling

    * 3 steg (Mats, Gunlög):
      * normalisering
      * ihoplänkning
      * annotering
    * svårt att få länkarna helt rätt
    * generellt positivt: editorn är inte på helt fel spår
  `)
  slide(md`
    # Återkoppling

    * interpunktation förvirrande som eget token
      * jag tror det går att förenkla
    * svårt att justera över meningsgränser
      * taggkategori saknas här också
      * se text3 och text6
  `)
  slide(md`
    # Återkoppling, gränssnittsmissar

    * var redigering sker: markören borde markeras i de olika vyerna
    * spaghettin ibland missvisande
    * går inte att läsa långa rader
    * inget sätt att se spaghettin för hela texten
  `)
  slide(md`
    # Återkoppling, kommunikation

    * lämna kommentarer från annotatör
    * mer om detta under "annotation campaign management" i e.m.
  `)
  slide(md`
    # Normalisering först, sen länkning

    * 3 steg (Mats, Gunlög):
      * normalisering
      * ihoplänkning
      * annotering
    * Mats normaliserade först och fixade sen med länkarna
      * Konceptuellt ett nytt steg att länka ihop källtexten med hypotesen
    * Jag tror det går att förenkla annoteringsprocessen
      * baserat på detta samt pga fåtalet komplicerade förflyttningar
  `)

  const apple = L.Ladder(G.modify_tokens(G.init('en äpple'), 0, 1, 'ett '))
  const side_by_side: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: '-1.5rem',
  }
  const svg_secedge: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: '100%',
  }
  const path_secedge = {
    stroke: 'red',
    strokeDasharray: '0 3 1',
    strokeWidth: '0.1em',
    fill: 'none',
  }
  const secedge = (
    <div style={side_by_side}>
      {apple}
      <div style={{position: 'relative'}}>
        {apple}
        <svg style={svg_secedge} viewBox="0 0 1 1" preserveAspectRatio="none">
          <path
            vectorEffect="non-scaling-stroke"
            d="M 0.2 0.5 C 0.2 0.25 0.67 0.5 0.67 0.25"
            style={path_secedge}
          />
        </svg>
      </div>
    </div>
  )

  slide(md`
    # Behövs sekundärbågar?
    ${secedge}
    * för kongruensfel, följdfel m.m.
    * lite mer jobb åt annotatörerna (och mig)
    * är det ett viktigt bidrag till korpusen?
      - vill man någonsin söka på dessa bågar?
      - därav sökscenarioexempelsinsamlingsinitiativet
  `)
  slide(md`
    # Separera ut lexikala fel

    * cap, ort, spl, comp
    * kanske kan ha etiktten på ordet istället för på bågen?
    * eller två lager
  `)
  slide(md`
    # Utforska pilotdatan!

    https://spraakbanken.gu.se/swell/private

    * använd samma inloggningsuppgifter som till piloten
  `)
  return (
    <div
      className={SlideStyle}
      onKeyDown={e => {
        if (e.key == 'ArrowDown' || e.key == ' ') {
          store.at('slide').modify(x => Math.min(x + 1, slides.length - 1))
        } else if (e.key == 'ArrowUp' || e.key == 'Enter') {
          store.at('slide').modify(x => Math.max(x - 1, 0))
        }
      }}
      ref={e => e && e.focus()}
      tabIndex={-1}>
      {slides[state.slide]}
    </div>
  )
}
