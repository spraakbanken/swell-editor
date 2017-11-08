import * as App from "./App"
import { Model } from "./App"
import * as CodeMirror from "codemirror"
import * as csstips from "csstips"
import "codemirror/lib/codemirror.css"
import "codemirror/mode/xml/xml"
import {debug} from './dev'
import './index.css'
import { patch } from "snabbis"
import { setup, attach } from "reactive-lens-snabbdom"
import { Store } from "reactive-lens"
csstips.normalize()
csstips.setupPage('#top')

const hash_text = decodeURIComponent(window.location.hash.slice(1))
const example_text = hash_text || "Jag bor på legenhet . Jag där bott ett år . Jag skulle vilja ha stor huset ."

// || "En dag jag vaknade när larmet på min telefon ringde. De väder var inte fint."

const store = Store.init(Model.init(example_text))
const root = document.getElementById('root') as HTMLElement

const patcher = setup(patch, root)
let off = attach(patcher, store, App.App)

declare const module: any;
declare const require: any;
declare const Debug: boolean

if (Debug) {
  if (module.hot) {
    module.hot.accept('./App.ts', (_: any) => {
      try {
        const NewApp = require('./App.ts').App
        off()
        off = attach(patcher, store, NewApp)
      } catch (e) {
        console.error(e)
      }
    })
  }
}

