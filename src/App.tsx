import * as React from "react";
import { connect } from 'react-redux'
import { combineReducers } from 'redux'
import * as B from "react-bootstrap"

interface AppProps {
  minutes: number,
  clicks: number,
  click: () => void
}

export const AppView = ({ minutes, click, clicks } : AppProps) => (
  <div className='container'>
    <div>
      <B.Label bsStyle="info">
        Running for {minutes.toString()} minute{minutes == 1 ? "" : "s"}.
      </B.Label>
    </div>
    <div>
      <B.Button onClick={click}>Clicks: {clicks}</B.Button>
    </div>
  </div>
);

interface State {
  minutes: number,
  clicks: number
}

export const App: React.ComponentClass<{}> = connect(
  (state: State) => ({
    minutes: state.minutes,
    clicks: state.clicks
  }),
  (dispatch) => ({
    click: () => dispatch(clickAction())
  })
)(AppView);

interface TickAction {
  type: "TickAction",
}

export function tickAction(): TickAction {
  return {
    type: "TickAction"
  }
}

interface ClickAction {
  type: "ClickAction",
}

export function clickAction(): ClickAction {
  return {
    type: "ClickAction"
  }
}

type Action = TickAction | ClickAction

export function tick_reducer(state: number = 0, action: Action): number {
  switch (action.type) {
    case "TickAction":
      return state + 1;
    default:
      return state;
  }
}

export function click_reducer(state: number = 0, action: Action): number {
  switch (action.type) {
    case "ClickAction":
      return state + 1;
    default:
      return state;
  }
}


export const app_reducer = combineReducers<State>({
  minutes: tick_reducer,
  clicks: click_reducer
})

