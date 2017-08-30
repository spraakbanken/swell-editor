import * as CodeMirror from "codemirror"
import './index.css'

const root = document.getElementById('root')

const hash_text = window.location.hash.slice(1)

const example_text2 = `En dag jag vaknade @@@ när larmet på min telefon ringde. De väder var inte fint.
Det var mycket kult ute med regn. Jag bara dricker te med två broad.

Min bussen går åtta i sju. Jag se min bus när jag borjade springer snabbt som bussen går. Jag var trott
som jag springed så mycket. Han är inte trevlig för mig efter jag missade @@@ bus.`

const example_text = hash_text || `En dag jag vaknade @@@ när larmet på min telefon ringde. De väder var inte fint.`

let View = require('./View')

let get = View.bind(root, View.init_data(example_text))

// could retain history, but we reinitialize the data here
window.onhashchange = () => {
  get = View.bind(root, View.init_data(window.location.hash.slice(1)))
}

declare const module: any;
declare function require(module_name: string): any;

if (module.hot) {
  module.hot.accept('./View.ts', (_: any) => {
    View = require('./View.ts')
    get = View.bind(root, get())
  })
}
