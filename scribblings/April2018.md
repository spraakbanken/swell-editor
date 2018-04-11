-;w Anonymisering: Vy för anonymisering som visar par av etiketter och source tokens
- Anonymisering: Byta ut target med edge labels
- Config för tagset
- Dropdown för tagset
- Visa en transkriberingsbild
- Spara till en backend
- Start från backend med bild, initial-state och lagringsplats
- Länka till en essay-id och position i iosaas png-renderen
- iosaas png-render med restrict side
- Länka till GH issues för editorn
- Länka till GH issues för annoteringsprojektet
- Flagga för om en fil är färdig! Då kan den gå vidare till nästa steg (vid anonymisering)

Backendkommunikation:
- https://spraakbanken.gu.se/swell-editor/edit?task=EssayID_string_or_similar
  > frågar backenden om state0 via `task` (och antagligen användarnamn på något sätt)
    > state0 kan innehålla en bild (för transkribering)
    > state0 kan vara uninitialized (så initierar frontenden statet med tokenisering)
    > innehåller också metadata om vi är i anonymiseringsläge eller annoteringsläge
  > vid uppdatering av state skickar (föregående och nya) till backenden
    > om mismatch så editeras det någon annanstans också: visa varningsmeddelande
    > annars bara spara på backenden, som kan göra en git trackning

- Widget v, >

- Möte onsdag 25e 10-12 april
