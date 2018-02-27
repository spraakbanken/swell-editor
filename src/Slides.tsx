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

import * as C from './Compact'

import {VNode} from './LadderView'

declare var require: any
const Remarkable = require('remarkable')
const remarkable = new Remarkable({linkify: true, typographer: true, html: true})

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
  readonly source: string
  readonly target: string
}

export const init: State = {
  slide: 0,
  source: 'preamble apa:Ort bepacepa xu depa flepa:Comp florp^preamble',
  target: 'apa bpea cpea dpeaflpae xlbabulr postscriptum^preamble woop^',
}

function html_rem_aspect_ratio(ratio: number = 16 / 10) {
  const html = document.getElementsByTagName('html')[0]
  const root = {height: html.offsetHeight, width: html.offsetWidth}
  const w = root.width / ratio
  const h = Math.min(root.height, w)
  const fontSize = (h / 20).toString() + 'px'
  html.style.fontSize = fontSize
  html.style.overflow = 'hidden'
}

export function App(store: Store<State>): () => VNode {
  const global = window as any
  global.store = store
  global.reset = () => store.set(init)
  global.G = G
  store.storage_connect('swell-slides')
  store.at('source').modify(s => s || '')
  store.at('target').modify(s => s || '')

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
    //borderBottom: '0.1em brown dotted',
    boxSizing: 'border-box',
    position: 'relative',
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
        fontFamily: 'Lato',
        fontWeight: 400,
        lineHeight: 1.5,
      },
      '& h1, & h2, & h3, & h4, & h5': {
        fontFamily: 'Source Sans Pro, Lato, sans-serif',
        fontWeight: 600,
        margin: 0,
      },
    },
  }
)

function secedge() {
  const graph = G.modify_tokens(G.init('en äpple'), 0, 1, 'ett ')
  const apple = L.Ladder(graph)
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
  return (
    <div style={{...side_by_side, fontSize: '0.9em'}}>
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
}

const logos = () => (
  <React.Fragment>
    <img
      style={{position: 'absolute', bottom: '1rem', right: '1rem'}}
      src={require('../talk/hws/logo_sb.jpg')}
    />
    <img
      style={{position: 'absolute', bottom: '1rem', left: '1rem'}}
      src={require('../talk/hws/logo_gu.png')}
    />
  </React.Fragment>
)

export const Input = (store: Store<string>) => (
  <input
    value={store.get()}
    style={{width: '100%'}}
    onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.set(e.target.value)}
  />
)

export function View(store: Store<State>): VNode {
  const state = store.get()
  const slides = [] as VNode[]
  const slide = (v: VNode) => slides.push(v)
  const s = C.test_parse(state.source)
  const t = C.test_parse(state.target)
  const g = C.units_to_graph(s, t)
  slide(md`
    # Annoteringspiloten i november
    * 9 texter annoterades
    * 1-4 annotationer per text
    * återkoppling muntligt och skriftligt
    * resultatet används som underlag för
      - vidareutveckling av verktyget
      - uppdatera kodboken
      - insikt om vad det är för korpus vi bygger
    ${logos()}
  `)
  slide(md`
    # Återkoppling

    * tre steg (Mats, Gunlög):
      * normalisering
      * ihoplänkning
      * annotering
    * svårt att få länkarna helt rätt
    * generellt positivt: editorn är inte på helt fel spår

      * addresserar många problem från Merlin-Adriannes presentation
  `)
  slide(md`
    # Återkoppling

    * interpunktation som eget token är förvirrande
    * svårt att justera över meningsgränser

      * taggkategori saknas här också
      * se text3 och text6
  `)
  slide(md`
    # Återkoppling, gränssnittsmissar

    * var redigering sker: markören borde markeras i de olika vyerna
    * spaghettin ibland missvisande
    * går inte att läsa långa meningar
    * inget sätt att se spaghettin för hela texten
  `)
  slide(md`
    # Återkoppling, kommunikation

    * lämna kommentarer som annotatör för kluriga passager
    * mer om detta under "annotation campaign management" i e.m.
  `)
  slide(md`
    # Återkoppling

    * Er feedback är lagrad i ärendehanteringssystemet på github:

      * https://github.com/spraakbanken/swell-editor/issues
  `)
  slide(md`
    # Normalisering först, sen länkning

    * tre steg (Mats, Gunlög):
      * normalisering
      * ihoplänkning
      * annotering
    * Mats normaliserade först och fixade sen med länkarna
      * Konceptuellt ett nytt steg att länka ihop källtexten med hypotesen
    * Kan leda till en förenklad annoteringsprocess:

      * baserat på detta samt pga fåtalet komplicerade förflyttningar
  `)
  slide(md`
    # Behövs sekundärbågar?
    ${secedge()}
    * för kongruensfel, följdfel m.m.
    * något mer jobb åt annotatörerna (och mig)
    * är dessa länkar ett viktigt bidrag till korpusen?
      - vill man någonsin söka på dessa bågar?
      - därav sökscenarioexempelsinsamlingsinitiativet
  `)
  slide(md`
    # Separera ut lexikala fel

    * CAP, ORT, SPL, COMP
    * dessa kanske kan ha etiktten på ordet istället för på bågen

      * eller två lager
  `)
  slide(md`
    # Utforska pilotdatan!

    https://spraakbanken.gu.se/swell/private

    * använd samma inloggningsuppgifter som till piloten
  `)

  slide(md`
    # Uppgiftsfördelningssystem
    ## Annotation campaign management
    ${logos()}
  `)
  slide(md`
    # Uppgiftsfördelningssystem

    Minst två huvudroller:

    * **annotator**:
      * har en lista på uppgifter och annoterar dem
    * **admin**:

      * ser till att uppgifter distribueras ut (sker med viss automation)
      * besvara frågor från annotatörerna
      * förvissar sig om att annotatorerna arbetar efter kodboken
  `)
  slide(md`
    ## Två separata annoteringsprocesser

    1.  **transkribering och anonymisering**
        * behöver ske med varsamhet då orginaldatan är känslig
    2.  **normalisering och ettikettering**:
        * indatan är här anonym
        * större krav på lingvistisk kunskap hos annotatören

    Två instanser av uppgiftsfördelningssystemet kan köras
  `)
  slide(md`
    ## Kravspecifikation

    * Annoterare ska kunna:

      * lista sina färdiga och återstående uppgifter
        <!-- - _behövs en logg var de har jobbat senast?_ -->
      * ställa och diskutera frågor...
        * ...knutna till en viss plats i en inlärartext
        * ...om något i kodboken
      * undvika att bli påverkade av andra annotatörer
      * se och söka i korpusen på sina egna och på "korrekta" delar
        * administratörerna gör denna bedömning
  `)
  slide(md`
    ## Kravspecifikation

    * Administratörer ska kunna:

      * lista allas färdiga och återstående uppgifter
      * besvara och diskutera frågor
      * distribuera uppgifter
        * automatiskt (jämnt fördelat)
        * manuellt (tex överensstämmighetsstickprov)
      * se statistik
        * tex agreement, confusion matrix, etikettdistribution
        * annoteringshastighet
      * se och söka i korpusen
  `)
  slide(md`
    # Koalakorpusen

    * Gerlof Bouma och Yvonne Adesam, Språkbanken
    * Frasträd och andra analyser för nusvenska texter
    * Issue tracker: _trac_
    * Uppgiftsfördelning: förfördelade filer i GU-box
    * Ingen kvalitetskontroll under annoteringen
    * 2-3 annotatörer
  `)
  slide(md`
    # Koala exempelissues
    ${(
      <img
        style={{position: 'absolute', top: '-15%', left: '-0%', width: '130%', zIndex: -1}}
        src={require('../talk/trac-issues.png')}
      />
    )}
  `)
  slide(md`
    ## Koala exempelissue
    ${(
      <img
        style={{position: 'absolute', top: '-72%', left: '-45%', width: '200%', zIndex: -1}}
        src={require('../talk/trac-issue.png')}
      />
    )}
  `)
  slide(md`
    # Koala exempelissue
    ${(
      <img
        style={{position: 'absolute', top: '-15%', left: '-25%', width: '120%', zIndex: -1}}
        src={require('../talk/trac-issue.png')}
      />
    )}
  `)
  slide(md`
    # Plan

    * Ett filsystem där alla ens texter är (som annoterare)
      * Administratören kan se alla annoterares filer
    * Använda ett ärendehanteringssystem
      * länkning till annoteringsverktyget
      * lätt att klistra in spaghettibilder
    * Ett frikopplat söksystem

      * där statistik kan fås fram (tex korp samt något för IAA)
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
