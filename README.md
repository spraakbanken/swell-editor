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
yarn run build
for i in dist/*js; do < $i closure-compiler --language_out ECMASCRIPT3 | sponge $i; done # optional for polyfills
scp dist/* fkswell@k2:/export/htdocs_sb/swell/dev
```

## Images of Spaghetti as a Service

There is also a web-service that takes a compact description of a parallell corpus sentence and renders it as a png, like this:

![](https://ws.spraakbanken.gu.se/ws/swell/png?Images~Images_of~Images_Spaghetti~Images_as_a~a_Service~%40t103//Spaghettibilder~Images_som_en~a_tj%C3%A4nst%40t103~%40t103)

This is run with

```
yarn run iosaas
```

The frontend and backend dependencies are shared in one big package.json for convenience.

_SB-specific_: The web service is run on `kork` using supervisord on port 8003 and its htaccess file is on k2 at `/export/htdocs_sbws/ws/swell`.
