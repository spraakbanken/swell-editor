import "codemirror/lib/codemirror.css"
import * as CodeMirror from "codemirror"
import "codemirror/mode/xml/xml"
import './index.css'
import {debug} from './dev'
import * as csstips from "csstips"
csstips.normalize()
csstips.setupPage('#top')

const root = document.getElementById('root') as HTMLElement

const hash_text = window.location.hash.slice(1)

const example_text = hash_text || "En dag jag vaknade när larmet på min telefon ringde. De väder var inte fint."

let View = require('./View')

const init = hash_text != "test" ? View.init_data(example_text) : {
  now: {
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
    ]
  },
  past: [],
  future: []
}

let get = View.bind(root, init)

// could retain history, but we reinitialize the data here
window.onhashchange = () => {
  get = View.bind(root, View.init_data(window.location.hash.slice(1)))
}

declare const module: any;

if (debug) {
  if (module.hot) {
    module.hot.accept('./View.ts', (_: any) => {
      View = require('./View.ts')
      get = View.bind(root, get())
    })
  }
}
