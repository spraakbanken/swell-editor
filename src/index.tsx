import * as React from "react";
import * as ReactDOM from "react-dom";
import { AppContainer } from "react-hot-loader";
import { App, app_reducer } from "./App";
import { tickAction } from "./Widgets";
import { createStore, applyMiddleware } from 'redux'
import { createLogger } from 'redux-logger'
import { composeWithDevTools } from 'redux-devtools-extension'
import { Provider } from 'react-redux'

const store = createStore(
  app_reducer,
  composeWithDevTools(applyMiddleware(createLogger({
    actionTransformer: (action) => ({ type: action.type, ...action.payload })
  })))
);

function send_tick() {
  store.dispatch(tickAction({}));
}

window.setInterval(send_tick, 60000);

const rootEl = document.getElementById("root");
ReactDOM.render(
  <AppContainer>
    <Provider store={store}>
      <App/>
    </Provider>
  </AppContainer>,
  rootEl
);

console.log('index.tsx update')

declare const module: any;
declare function require(module_name: string): any;

if (module.hot) {
  module.hot.accept(['./App', './Widgets', './State', './connect'], () => {
    console.log('Updating roots...')
    const App = require('./App')
    const nextRootReducer = App.app_reducer;
    store.replaceReducer(nextRootReducer);
    const NextApp = App.App;
    ReactDOM.render(
      <AppContainer>
        <Provider store={store}>
          <NextApp />
        </Provider>
      </AppContainer>,
      rootEl
    );
  });
}
