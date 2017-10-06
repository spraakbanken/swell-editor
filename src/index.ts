import "codemirror/lib/codemirror.css"
import * as CodeMirror from "codemirror"
import "codemirror/mode/xml/xml"
import './index.css'
import {debug} from './dev'
import * as csstips from "csstips"
import * as AppTypes from "./AppTypes"
csstips.normalize()
csstips.setupPage('#top')

const root = document.getElementById('root') as HTMLElement

const hash_text = decodeURIComponent(window.location.hash.slice(1))

const example_text = hash_text || "En dag jag vaknade när larmet på min telefon ringde. De väder var inte fint."

let App = require('./App')

const init = hash_text != "test" ? AppTypes.init_app(example_text) : {
  app_state: AppTypes.init_undoable({
    tokens: ['aaa ', 'abc ', 'ghi ', 'def '],
    spans: [
      {
        "text": "rst ",
        "labels": [],
        "links": [],
        "moved": false
      },
      {
        "text": "aba ",
        "labels": [],
        "links": [ 0 ],
        "moved": false
      },
      {
        "text": "jkl ",
        "labels": [],
        "links": [],
        "moved": false
      },
      {
        "text": "dexhi ",
        "labels": [],
        "links": [ 3, 2 ],
        "moved": true
      }
    ]}),
  show_xml: false
}

let get = App.bind(root, init)

// could retain history, but we reinitialize the data here
window.onhashchange = () => {
  get = App.bind(root, App.init_data(window.location.hash.slice(1)))
}

declare const module: any;

if (debug) {
  if (module.hot) {
    module.hot.accept('./App.ts', (_: any) => {
      try {
        App = require('./App.ts')
        get = App.bind(root, get())
      } catch (e) {
        console.error(e)
      }
    })
  }
}
