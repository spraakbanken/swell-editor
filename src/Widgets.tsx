import * as React from "react";
import connect from './connect'
import { combineReducers } from 'redux'
import * as B from "react-bootstrap"
import actionCreatorFactory from 'typescript-fsa'
import { reducerWithInitialState } from 'typescript-fsa-reducers'
import { State } from './State'

const action = actionCreatorFactory();

interface TickProps {
  minutes: number,
}

export const TickView = ({ minutes } : TickProps) => (
  <div>
    <B.Label bsStyle="info">
     Running for {minutes.toString()} minute{minutes == 1 ? "" : "s"}.
    </B.Label>
  </div>
)

export const Tick = connect<State, TickProps>(
  (state) => ({
    minutes: state.minutes
  }),
  () => ({})
)(TickView)

export const tickAction = action<{}>("tickAction");
export const tick_reducer = reducerWithInitialState(0).case(tickAction, (state) => state + 1);


interface TextProps {
  text: string,
}

interface TextHandlers {
  submit: (text: string) => void
}

export const TextView = ({ text, submit } : TextProps & TextHandlers) => {
  let input: any;
  return (
    <div className='container'>
      <div>
        <input type="text" ref={(r: any) => {input = r;}}/>
        <B.Button onClick={(e) => submit(input.value)}>Submit</B.Button>
      </div>
      <div>
        Written so far:
        <pre>{text}</pre>
      </div>
    </div>
  );
}

export const Text = connect<State, TextProps, TextHandlers>(
  (state) => ({
    text: state.text
  }),
  (dispatch) => ({
    submit: (text) => dispatch(submitAction({text: text}))
  })
)(TextView);

export const submitAction = action<{text: string}>("submitAction");
export const text_reducer = reducerWithInitialState('').case(submitAction, (state, { text }) => {
  console.log('reducing...');
  return state + ' ' + text
});

