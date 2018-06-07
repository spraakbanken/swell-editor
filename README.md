# SweLL normalization editor

This is an editor for normalising, i.e. error annotating, learner texts.

Actually it is a glorified diff editor which makes a word-aligned parallel text, like this:

![](https://ws.spraakbanken.gu.se/ws/swell/png?He_get_to_cleaned_his~his_son~his_.//He_got_his~his_son~his_to_clean_the~_room~_.)

This tool is in active development, and described further here:

* [Development version](https://spraakbanken.gu.se/swell/dev)
* [Tool description](https://spraakbanken.gu.se/swell/article) Dan Rosén
* [Towards Transformation-based Annotation of Norm Deviations in an Infrastructure for Research on Swedish as a Second Language](https://spraakbanken.gu.se/swell/docs/swell-lrec2018.pdf) Dan Rosén, Mats Wirén, Elena Volodina, submitted to LREC 2018.
* [Representation av avvikelseannotationer](https://spraakbanken.gu.se/swell/representation-2017/) (in Swedish)

Slides, change slides with up and down arrows:
* [SweLL meeting January 2018](https://spraakbanken.gu.se/swell/jan2018) (in Swedish, "print mode" on p)
* [CLT retreat 2017](https://spraakbanken.gu.se/swell/clt-2017)
* [L2 Clarin workshop 2017](https://spraakbanken.gu.se/swell/clarin-2017)
* [En förhandstitt på verktyget för normalisering av andraspråkstexter](https://github.com/spraakbanken/swell-editor/blob/c13475d2e14a53a3e86e5b0f0861f9dbf5411af3/talk/hws/hws-talk.pdf) (pdf, in Swedish)

### Running the tool

```
yarn
yarn run serve
```

### Testing

```
yarn run test
```

End to end:

```
yarn run serve # start server on port 1234
yarn run test:e2e
```

Coverage:

```
yarn run coverage
```

While developing:

```
yarn run doctest:watch
```

### Deployment

_SB-specific_:

```
yarn run deploy
```

### Updating the taxonomy

The intent is that the taxonomy should come from the backend. However, it can also be updated in `src/Editor/Config.ts` and then deployed (see above).

## Backend connection

The url hash contains two fields for talking to a backend: `backend` and `essay`.
The `backend` should a base64 encoded url. You can set this from the developer console like this:

```typescript
store.update({backend: 'https://spraakbanken.gu.se/swell/dev-backend/annotation/essay/', essay: 'K0Rv'})
```

The store is only fetched on page load, so you'll need to reload the page after setting this.

The `start_mode` flag can be `norm` or `anon` and will start the editor in that mode.

Note that while there is a backend connected it is not possible to change mode
(anonymisation or normalisation) or edit the source text.

The `backurl` will add a _back_ link to an url (base64-encoded).

## Images of Spaghetti as a Service

There is also a web-service that takes a compact description of a parallell corpus sentence and renders it as a png, like this:

![](https://ws.spraakbanken.gu.se/ws/swell/png?Images~Images_of~Images_Spaghetti~Images_as_a~a_Service~%40t103//Spaghettibilder~Images_som_en~a_tj%C3%A4nst%40t103~%40t103)

This is run with

```
yarn run iosaas
```

The frontend and backend dependencies are shared in one big package.json for convenience.

_SB-specific_: The web service is run on `kork` using supervisord on port 8003 and its htaccess file is on k2 at `/export/htdocs_sbws/ws/swell`.
