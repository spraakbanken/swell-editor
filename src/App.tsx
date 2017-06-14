import * as React from "react";
import connect from './connect'
import { combineReducers } from 'redux'
import * as B from "react-bootstrap"
import actionCreatorFactory from 'typescript-fsa'
import { reducerWithInitialState } from 'typescript-fsa-reducers'

interface AppProps {
  minutes: number,
  text: string,
}

interface AppHandlers {
  submit: (text: string) => void
}

export const AppView = ({ minutes, text, submit } : AppProps & AppHandlers) => {
  let input: any;
  return (
    <div className='container'>
      <div>
        <B.Label bsStyle="info">
          Running for {minutes.toString()} minute{minutes == 1 ? "" : "s"}.
        </B.Label>
      </div>
      <div>
        <input type="text" ref={(r: any) => {input = r; console.log(input);}}/>
        <B.Button onClick={(e) => submit(input.value)}>Submit</B.Button>
      </div>
      <div>
        Written so far:
        <pre>{text}</pre>
      </div>
    </div>
  );
}

interface State {
  minutes: number,
  text: string
}

export const App: React.ComponentClass<{}> = connect<State, AppProps, AppHandlers>(
  (state) => ({
    minutes: state.minutes,
    text: state.text
  }),
  (dispatch) => ({
    submit: (text) => dispatch(submitAction({text: text}))
  })
)(AppView);

const action = actionCreatorFactory();

export const tickAction = action<{}>("tickAction");
const tick_reducer = reducerWithInitialState(0).case(tickAction, (state) => state + 1);

export const submitAction = action<{text: string}>("submitAction");
const text_reducer = reducerWithInitialState('').case(submitAction, (state, { text }) => {
  console.log('reducing...');
  return state + text
});

export const app_reducer = combineReducers<State>({
  minutes: tick_reducer,
  text: text_reducer
})

