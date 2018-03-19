
## Comments on "SweLL anonymisation process & guidelines"

I think the correct thing to do is what you call _manipulation using variables_.
But you can do better than substituting the entity with just a variable. Instead
choose a record with rich meta-data. It will contain what kind of entity it is,
a unique identifier so it can be told apart from other entities of the same kind and possibly more meta-data.
This way you can replace the variable/record with a set of pre-defined names
to make it read like an actual text (this is referred to as _random exchange_ in your text).

I've sketched out the details of a metadata record before and then I wrote this:

```typescript
type corpus = Array<string | AnonymizationRecord>

interface AnonymizationRecord {
  unique_number: int,
  kind:    unknown | person | place | event | ...
  gender:  unknown | m | f | ...
  culture: unknown | L1 | L2 | ...
}
```

A big plus with such an internal representation is that it acts as an indirection
to how you want to view the data. This separates the anonymisation problem into two:

1. abstractly: what kind of meta data is necessary?
2. concretely: how do we want to present this meta-data to users of the corpus?

The second task means that you can choose how you want to view these records,
for example replace them with suitable names that could be the same across all texts. Or unique.

This separation makes it easy to see that there are many meta-data decisions to make. Here are some examples from the top off my head:

1. Morphosyntactic features of the word. Such as being in genitive (my mothers's). This will be necessary to
linearise the abstract records to grammatically correct text. Full msd might be necessary when anonymising
entities such as _Språkintroduktion på lindholmen_.
2. Correct spelling (such as _Ungen_ instead of _Ungern_), correct capitalization. Has the learner written the entity correctly?

### Questions from video meeting 16/3

Mats suggests using a full msd tag for the anonymized entities. Suggestion: SUC3.

Gunlög says that spelling mistakes might not be so important, however she might
be biased and will consider how important it might be for other researchers.
Bea raised the question about how to render records that are marked as having
incorrect spelling. Probably we should not try to do that since they will
just give a systematically incorrect error. A label will have to do.

Follow-up errors from professions, subjects of study and what kind of public transport is used.

Elena notes that the meta-data from anonymisation can be used for other experiments,
for example checking biases by rendering the names differently.

I wonder if it make sense to anoymize data that exists in the student meta-data anyway.
For example, if we know the L1 the country of origin could stay in place.

Texts with the student itself as topic, _"om mig"_ could be aggregated, for example under the same swell-id.

