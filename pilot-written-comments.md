# 3 Error taxonomy
Julia:
- Nånstans bör vi kanske förklara att interpunktion räknas som token, dvs behandlas
som ord - det är inte självklart för oss icke-datalingvister och det är bra om man slipper
undrar över varför de står separerade från orden i texten.

# 7. Manual
Mats:
Annoteringen innefattar tre steg: normalisering av texten, att få till rätt länkar mellan
källtext och normaliserad text, och felannotering. (Jag hade tidigare inte tänkt på det
andra steget som ett separat steg.)
- other information that needs to be described here

Gunlög:
Arbetsgång: tydliggör de tre stegen.
1. Normalisera ett stycke. Dra markören över hela det
uttryck som ska ändras om det är en fras, för att noderna ska hamna
rätt. (Hur viktig är noden? Svårt ibland.)
2. Kolla noderna Vikten av att noderna är “rätt” syns inte i
instruktionen. Revert om du vill ändra en fras.
3. Etikettera till sist noderna med avvikelsekoden.

Skillnad på revert och undo? De används nu tillsammans?

Gunlög:
Titel: ingår inte avvikelsemarkeringen/kodningen (error annotation) i
normaliseringsarbetet? Inte bara normalisering som det ser ut nu?

# 7. Manual for the tool (comments)
Elena: An excellent manual, I love those flms!

7.1 Add instructions for insertions (M — missing)

7.2. Add some information about the rest of the buttons, like sync.

7.3. Manual will need to be updated with new flms for the current version (i.e. the
/future/ one we will be using with annotators)
/future/ one we will be using with annotators)

# 8.Tool(comments)
För mig vore det mer intuitivt att ha editeringsfönstret till vänster i stället för till höger
Vore bra om aktuell mening i käll- och editeringsfönstret kunde markeras (highlightas
med färg t ex), och att man kunde fytta sig frammbak mening för mening med en
knapptryckning

# 8. Tool (comments)
Julia:
- Det framgår inte riktigt av ”spagettin” vilket/vilka ord det är som fyttats, så det blir lite
missvisande och lite oklart varför man sätter taggen på det ena och inte det andra ordet.

# 8. Tool (comments)
Elena
The tool was really easy to use, and version 2 was fantastic, with all codes and
explanations right there in front your eyes. Maybe even good to add one example for
each category into the unfordable code list?
Suggestions:
8.1. Difcult to see where you are in the text (window 2, and also 1). Maybe the actual
sentence you are working in should be highlighted In some way?
8.2. Long sentences in the parallel view graph should be scrollable
8.3. An option to download an annotated text?
8.4. An option to insert your own text for testing (e.g. in another language)
8.5. If we think of distributing )eventually) the tool to other projects/languages, then there
should optimally be a chance to modify error tags.
8.6 undo was not always working
(dvs verbet, adverbialet) även här

# 8
Lena: jag tycker bäst om att jobba med texterna när de ligger bredvid
varandra (typ 2) men att den långa listan med mer explicita koder
fungerar bra när jag behöver leta kod, när jag redan vet vilken kod jag ska
använda fungerar den lilla ”kodboxen” (typ 1) på ett smidigare sätt, det
blev mycket tidskrävande skrollande i typ 2. Jag tycker dock de korta
koderna ska ha olika färg, t ex varannan blå och varannan röd så man
lättare kan skilja de åt. I typ 2 kan man råka lägga till fer än en kod för
verktyget hänger liksom kvar, i typ 2 försvinner texterna när man jobbar i
grafen och då måste jag hela tiden plocka tillbaka texterna för att jämföra
och det tar lite tid.

Det skulle vara bra om man kunde lämna en kommentar till sig själv i
verktyget – typ ”Kolla detta!!”

Det skulle vara bra om verktyget sa till när man lämnade en text att alla
taggar inte fått en felkod, så man inte missar nån

Flyttning av adverbial måste utföras fera gånger (drag and drop) innan
det görs rätt

# 11. Other (comments, suggestions)
Bea:
* Difcult to disconnect the punctuation with the preceeding added word token.
    Rummet är bra men köket inte ->
    Rummet är bra men köket [är inte bra .]_M istället för [är]M [bra]_M

* Svårt att annotera redundanta ord som kan strykas samtidigt som det ska ersättas med andra
ord. Jag kom till Sverige och började skolan efter några månader. [Text 6]

* Hur ska man annotera när ett komma ska ersättas med ord istället? Och hur ska den visualiseras
i grafen? Nya ord som läggs till kopplas till föregående ord som grupp. Ska det borttagna ordet
hänga i luften då?

* Länkning kräver extra genomgång och tydliga instruktioner med exempel i guidelines. Verktyget
tillåter ändringar men hur ska man gå tillväga?

* Hur ska man splittra (”disconnect”) två meningar? Verktyget hoppar till början av meningen och
stannar inte vid det markerade området. Splittra mening ska man tydligen göra i
normaliseringseditorn och inte i grafen. Men då hamnar första ordet i mening två i slutet av

Saknas kategori för ny mening. Ska M täcka det? Tex Jag bara studera 4 ämne i skolan och på
frididen träna jag på gym och ibland jag går på bibiliotek -> Jag bara studera 4 ämne i skolan och
på fritiden träna jag på gym och ibland jag går på bibliotek

Sätt att annotera:
1. Stavfel
2. Noder- länkar
3. Annotera fel på meningsnivå
4. Annotera fel på textnivå gällande diskursfel/osammanhängande text.

