import * as React from "react";
import { combineReducers } from 'redux'

import { Tick, Text, tick_reducer, text_reducer } from './Widgets'
import { State } from './State'

export const App = () => (
  <div className='container'>
    <Tick/>
    <Text/>
  </div>
);

export const app_reducer = combineReducers<State>({
  minutes: tick_reducer,
  text: text_reducer
})

