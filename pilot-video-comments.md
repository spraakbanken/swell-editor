
Q: olika slags annoteringar i klump
    Elena kanske har ett exempel
        - kanske flera lager
    Mats: inkonsistenser:
        - man vill binda ihop komponententrna på olika sätt
        - låter vettigt med flera nivåer för att undvika
          inkonsistenser

Bea använde v1:
    - svårt att lära sig
        - splittning ointutivt i grafen
        - hur splittrar man dem i grafen
        - var ska ändras i grafen och vad i editorn

    - två fel i tokeniseringen:
        - behövs att man kan ändra pga felmeningssegmentering
        - eventuellt kan man ha en speciellt etikett som beskriver fel automatisk
          uppmärkning för internt bruk

    - ibland behövs det att göra ändringar över diskurs tex över meningsgränserna
      tex text1 behöver ett stort kontext för att föra in ett ord lägenhet
        - för diskursändringar

    - Mycket viktigt: Segmentering i text3 och text6


    Etiketterna:
    - subkategorin: när ska det var den generella
      och när en mer specifik?


Elena:
    - tyckte att det gick bra att byta mellan grafen och editorn
    - #21 scroll or split long sentences
    - #1 mer feedback vilken mening man är i med exv HL
        - #1 Mats: markera de nuvarande meningarna i gult
    - ## så att det är lättare att hitta var man är


    Ettiketterna:
        PUNC kan vara i en egen kategori
        - Vad gör man med partikelverb? R-PREP eller ej?
            Lena: Det är ett vanligt område för fel
                Hela läroböcker kan man hitta för bara partikelverb
        - Frasverb / phrasal verb behöver också kunna markeras
        - på vilken nivå sätter man ID? Behöver man alltid sätta ID?
        - X-koden kanske när man inte vet vad man ska ändra


Gunlög:
    Etiketterna:
    - pedagogiskare att ha de specifika subkategorierna
      innan den mindre specifika generalla versionen
    - En kategori för osammanhängande kanske inte är så dumt
        - Risk just nu att X används istället
    - Vill ha en snabb markör för stavfel för att de är så vanliga
        (Tex ett snabbkommando)
    - Förvirrad över wrong word som punctuation under "Lexical"
        Vad är ett punktuationsfel på lexikal nivå

    - Viktigt att tänka på de tre konceptuellt steg
    - Har använt revert mycket, tror att användarna kommer hitta sitt sätt

    - Namn:
        - Deviation error eller deviation annontation
            - Elena: men vad är negativast?
            - Gunlög: det beror på vilken målgrupp du pratar med
            - Elena: inlärarfenomen finns också som terminologi

    Etiketterna:
        - F-DEF
        - Lyfta ut stavningen och göra det ett separat steg
            - Mats: håller delvis med... men tycker det
                främst är ointutivt för att felen hänger ihop
                och inte går att isolera just stavfelen
            - Lena: de texter jag har jobbat med har inte haft så
                mycket stavfel
                Kanske är skillnad då när man har en text
                med övervägande stavfel


        - AGR dåligt namn
        - Lena & Gunlög: var ska obestämd artikel vara F-GENDER?
            Dan: F-* kategori är inte kompletta

    - Som var på Lenas inlägg att det behövs ett diskussionsforum:
    - Var ska vi lagra diskussioner?
        - Exv: bisats med att
            - Vi behöver ta ett beslut hur de ska annoteras
                - Beror också på kontext hur talspråkig den är.
                  SAG har vissa verb där att inte används
                    - Lena: Att följa SAG kan strida mot konceptet minimal ändring
            - Julia: bra exempel på något där det är oklart
              vad normen är. Språkbruk i förändring
        - Ett annat exempel 'Jag pratade med han'
            - Lena: vi kan ange tonen genom att bestämma hur vi
              gör i de här exemplena, men det kommer alltid finnas undantag
        - Ibland behöver vi bestämma vad vi tycker är normen
          Bestämmer oss till en norm som vi följer


Julia:
    - Svårt att flytta ord någonstans
    - Spaghettin visar inte alltid just det orden en har flyttat på.

    Etiketterna:
        Är van vi etiketterna så tyckte inte de var så problematiska.
        Ologiskt att F-* kategorin inte är komplett



Lena använde v1 och v2
    - #20 Mindre box när man är van
    - Svårt att flytta verb och adverbial
        - #22 Behöver bli lättare
        - #23 Info när man inte lagt etikett på något
            - Tex när man stänger ner
        - #25 leave comments for self and others
    Etiketterna:
        - COM för compounding
        - WO och word order
        - Kanske vill man sätta samma etikett flera gånger, tex om man har många olika slags stavfel i samma
            Elena: tycker det räcker med en kod, men överlåter
    - Behöver ett sätt för annotatörerna att starta
      kommunikation/diskussion med oss
    - Brukar vara skeptisk mot ny teknik men tyckte om det
      var som julafton :)


Mats:
    - blev inte så mycket spaghetti
    - kan se det som tre steg:
        - normalisering
        - ihoplänkning
        - etiketter
      (Till synes) Alla håller med
      Gunlög: andra steget att se över noderna
      Bea: just länkarna som jag hade mest problem med
    - Mats normaliserade först och sen pillade med länkarna
        Konceptuellt ett nytt steg att länka ihop
        källtexten med hypotesen
    - Vill ha editeringsfönstret till vänster
        Gunlög håller inte med
        Mats: parametrisera det här för användarna
        Elena: (samma) konfigurera fönstrena

    Mats:
        - Största problemet var felkategorierna
        - Misstänker att det inte går att göra kategorier som är ömsesidigt uteslutande

Sämst koder:
    PART
    SPL
    F för morfologi (står för Form Mats: finns ju i syntax också)
    Mats: Mest förvirrande AGR:
        Agreement error dåligt namn
        Föreslår Consequential Correction
