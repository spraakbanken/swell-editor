# Images of Spaghetti as a Service (IoSaaS)

Spaghetti is a synonym of the ladder view, which could look like this:

    Efter en tima  gick jag till ett plats som min faster och min cousin väntade på mig der
               |                  |         |                       |                    |
               |                  |         x                       |                    |
               |                  |          _______________________|____________________/
               |                  |         /                       |
    Efter en timma gick jag till en  plats där min faster och min kusin  väntade på mig

The idea is to make a web service that renders a spaghetti as a PNG.
This can then be included on webpages and on issue trackers. In particular, in markdown
images can be included with this syntax:

    ![](https://spraakbanken.gu.se/sites/spraakbanken.gu.se/files/sb_logo.jpg)

Which, if included in a markdown document, yields this image:

![](https://spraakbanken.gu.se/sites/spraakbanken.gu.se/files/sb_logo.jpg)

(The placeholder between the square brackets is for the `alt` text of the image)

This requires a a space-efficient, and preferably human-readable, textual representation of
parallel corpora spaghetti. I will now outline my ideas how to do this:

### Efficient textual representation of the graph

We will use two strings, first the source text and below the target hypothesis.
We will automatically diff the two texts:

    Efter en tima gick jag till ett plats som min faster och min cousin väntade på mig der
    Efter en timma gick jag till en plats där min faster och min kusin väntade på mig

We will not try to be smart, so diffing this would erroneously handle the word movement, like this:

    Efter en tima  gick jag till ett plats som     min faster och min cousin väntade på mig der
               |                  |         |                            |                   |
               |                  |         x                            |                   x
               |                  |             o                        |
               |                  |             |                        |
    Efter en timma gick jag till en  plats     där min faster och min kusin  väntade på mig

For long word movements the user must write the source word for a target word using the up `^` ascii art, like so:

    Efter en tima gick jag till ett plats som min faster och min cousin väntade på mig der
    Efter en timma gick jag till en plats där^der min faster och min kusin väntade på mig

This will tell the semi-smart differ to manually connect the target `där` with the source word `der`.
The remaining words will be connected automuatically

If we want to label parts we add a colon:

    Efter en tima:Ortography gick jag till ett:Form-Det plats som min faster och min \
        cousin:Ortography väntade på mig der:WordOrder,Ortography
    Efter en timma gick jag till en plats där^der min faster och min kusin väntade på mig

Note: we put the annotation on the source text because that is the location of the error.

### details

* escaping: if the word contains `:` or `^` we escape it with some character, say `~`, like so:

      en ~fraga:~:Ortography "varför?"
      en ~fråga:~ "varför?"

* to connecting several words, use many `^`:

      bepa cepa
      apa^bepa^cepa

  for the graph


      bepa  cepa
        \_ __/
          Y
          |
         apa


## The image service

Now the plan is to include images with something like this:

    ![](https://spraakbanken.gu.se/swell/ws/iosass?
        Efter en tima:Ortography gick jag till ett:Form-Det plats som min faster och min cousin:Ortography väntade på mig der:WordOrder,Ortography
        Efter en timma gick jag till en plats där^der min faster och min kusin väntade på mig
    )

The image will be rendered server-side to PNG using PhantomJS.

Metadata of the input texts can be embedded into PNG in the `tEXt` data field: https://www.w3.org/TR/PNG/#11tEXt
