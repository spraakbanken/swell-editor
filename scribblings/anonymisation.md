
## Comments on "SweLL anonymisation process & guidelines"

I think the correct thing to do is what you call _manipulation using variables_.
But you can do better than substituting the entity with just a variable. Instead
choose a record with rich meta-data. It will contain what kind of entity it is,
a unique identifier so it can be told apart from other entities of the same kind and possibly more meta-data.
This way you can replace the variable/record with a set of pre-defined names
to make it read like an actual text (this is referred to as _random exchange_ in your text).

I've sketched out the details of a metadata record before and then I wrote this:

```typescript
corpus: Array<string | AnonymizationRecord>

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

This separation makes it easy to see that we need to make decisions if this meta-data will be necessary:

1. Morphosyntactic features of the word. Such as being in genitive (my mothers's). This will be necessary to
linearise the abstract records to grammatically correct text. Full msd might be necessary when anonymising
entities such as _Språkintroduktion på lindholmen_.
2. Correct spelling (such as _Ungen_ instead of _Ungern_), correct capitalization. Has the learner written the entity correctly?
