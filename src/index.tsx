import * as React from "react";
import * as ReactDOM from "react-dom";
import { AppContainer } from "react-hot-loader";
import { App, app_reducer, tickAction } from "./App";
import { createStore, applyMiddleware } from 'redux'
import { createLogger } from 'redux-logger'
import { composeWithDevTools } from 'redux-devtools-extension'
import { Provider } from 'react-redux'

const store = createStore(
  app_reducer,
  composeWithDevTools(applyMiddleware(createLogger())));

function send_tick() {
  store.dispatch(tickAction());
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

declare const module: any;
declare function require(module_name: string): any;

if (module.hot) {
  module.hot.accept("./App", () => {
    const nextRootReducer = require('./App').app_reducer;
    store.replaceReducer(nextRootReducer);
    const NextApp = require("./App").App;
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
