### Sökscenarion i andraspråkskorpusar

_Dan Rosén, Systemutvecklare, Språkbanken, GU, januari 2018_

Det här är ett initiativ till att samla in exempel på sökfrågor i
andraspråkskorpusar.
Detta sker under ramen för [SweLL-projektet](https://spraakbanken.gu.se/swe/swell_infra).
Exemplen kommer användas som beslutsunderlag till
dessa två syften:

1. hur korpussökningssystem bör designas och anpassas för att kunna ställa sådana sökfrågor
2. vilka annoteringar som är användbara för att kunna besvara sådana sökfrågor


Sökfrågeexempel eftersöks från alla slags slutanvändare
(såsom forskare, lärare, inlärare och studenter).

För att illustrera vad som sökes ges här några exempel på exempel på
sökfrågor.  De är skrivna i ett förstapersonsperspektiv för att vara
lätttillgängliga och begripliga. Notera att de inte nödvändigtvis
återspeglar några egentliga behov! Det är bara något jag skrivit ihop för att
förklara vad jag är ute efter. Men om det inte passar hur ni vill använda
inlärarkorpusar uppmuntrar jag er att bryta mallen och uttrycka er fritt.

Fyll på med exempel på liknande form som du skulle vara intresserad av eller
vad du tror att dina kollegor eller ditt forskningsfält skulle ha nytta av.
Relevant forskning eller bakgrund i exempelvis artiklar eller avhandlingar
får du naturligtvis referera till.

Jag har inte kunnat skriva någon förklaring eller anledning för varför just dessa
är särskilt intressanta att undersöka (eftersom jag har hittat på dem), men en
kommentar ungefär på den här formen skulle vara hjälpsamt:

> Anledningen till detta exempel är forskningen X som hävdar fenomenet Y (se publikation Z).

#### Exempel 1: Sökning efter en viss slags stavningsavvikelse

Jag vill kunna hitta när _o_ används istället för _å_.

Så om dessa meningar finns i korpusen vill jag hitta dem, med fokus på det
kursiverade ordet:

> *Jag gick _po_ stan

> *Hur har det _gott_ i helgen?


#### Exempel 2: Jämföra olika förstaspråk med avseende på ett visst fenomen

Jag vill se hur många förekomster det finns av ett visst fenomen, tex när _o_ används istället för _å_, grupperat efter L1.

Jag vill kunna se resultatet i en tabellform, tex såhär:

| L1 | Meningar totalt i korpusen med detta L1 | Antal meningar med detta L1 där fenomenet förekommer | Procent |
| --- | --- | --- | --- |
| Franska | 1000 | 10 | 1% |
| Spanska | 2000 | 50 | 2.5% |

#### Exempel 3: Hitta ett formfel i en viss ordklass (såsom determinerare)

Jag vill kunna få resultat som dessa om de förekommer i korpusen, med fokus på determineraren:

> *Jag åt _en_ äpple

> *Visste du om _den_ båtarna?

#### Exempel 4: Undersöka ett visst fenomen longitudinellt

Givet att det finns longitudinell data i korpusen så vill jag kunna följa
ett fenomen över tid, tex procentuellt hur många determinerare
som har formfel.

Resultatet vill jag se i tabellform:

| Inläraridentifierare | % formfel i determinerare i uppgift A, dag 0 | i uppg. B, dag 14 | i uppg. C, dag 28 |
| --- | --- | --- | --- |
| Inlärare X | 6.25 | 2.75 | 1.85 |
| Inlärare Y | 7.25 | 8.16 | 9.15 |

#### Exempel 5: Hitta negationer på fel plats i bisatser

Jag vill kunna få sökträffar som dessa om de förekommer i korpusen, med fokus dels på bisatsen och dels på negationspartikeln:

> *Om man bor där _man kan __inte__ hitta jobb_ är det svårt.

> *Jag visste inte _eftersom jag har __inte__ varit i Sverige förut._

