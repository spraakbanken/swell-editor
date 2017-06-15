import * as React from "react";
import * as ReactRedux from 'react-redux'
import { Dispatch } from 'redux'
import { State } from './State'

interface CreateComponent<PH> {
  (component : (React.Component<PH, {}>)): React.ComponentClass<{}>
}

interface CreateComponent<PH> {
  (component : ((ph : PH) => JSX.Element)): React.ComponentClass<{}>
}

export default function connect<State, Props, Handlers = {}, Own = {}>(
  state_to_props: (state: State, own: Own) => Props,
  props_to_dispatch: (dispatch: Dispatch<State>, own: Own) => Handlers
): CreateComponent<Props & Handlers & Own> {
  return (ReactRedux.connect as any)(state_to_props, props_to_dispatch);
}


