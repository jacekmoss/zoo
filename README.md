# Moje Zoo

Tycoon budowy zoo dla czterolatka. Canvas i czysty JS, bez budowania. Grafika: `assets.js` (zaakceptowana kanwa + dopisane w tym samym stylu nowe zwierzęta, kioski i wybiegi).

Uruchomienie: dwuklik `start.bat` (włącza serwer, jeśli nie działa, i otwiera grę) albo `python -m http.server 8765` i http://localhost:8765/.
Otwarcie samego `index.html` też działa, ale bez nagrań lektora i z osobnymi zapisami.

Zasady:
- 12 działek (4×3), każda ma 4 miejsca na wybieg lub kiosk i krzyż pól na ścieżkę.
- Ścieżka kosztuje 1 monetę za pole; przy zerze monet pole jest darmowe, więc nie da się utknąć.
- Goście chodzą tylko po ścieżce połączonej z bramą i zwiedzają 2–3 miejsca.
- Zarobek: tylko bilet przy bramie (1 moneta, czasem +1 napiwku, gdy na ścieżkach nie ma śmieci) i zakupy w kioskach. Wybiegi nie płacą,
  ale przyciągają gości: im więcej nakarmionych i różnych zwierząt, tym częściej ktoś przychodzi.
- Zadania: głodne zwierzę (dymek z miską) nie przyciąga gości, dopóki go nie nakarmić; pusty kiosk (skrzynka) nie sprzedaje,
  dopóki go nie uzupełnić; śmieci na ścieżkach zbiera się dotknięciem lub palcem.
- Życzenie gościa: gość za drogą pokazuje w dymku zwierzę lub kiosk, którego jeszcze nie ma; postawienie go daje premię.
- Gwiazdki za liczbę różnych zwierząt i kiosków (2, 4, 6 … 18) odblokowują kolejne. Album pokazuje odkryte.
- Bez przegranej: gdy w zoo nie ma żadnego zwierzęcia, gra dosypuje monety na zwierzę.
- Teren: działki mają drzewa, skały, piach, mokradła i jeziora. Uprząta się je tylko ręcznie: dotknięcie przeszkody wysyła robotnika (1–3 monety, bez monet za darmo); dotknięcie pustego fragmentu miejsca zleca całe miejsce. Na przeszkodzie nie da się budować.
- Budowa trwa (12–30 s), widać plac, rusztowanie i robotników; dotykanie placu lekko przyspiesza.
- Zadowolenie 0–100 (buźka u góry): karmienie, choroby, śmieci, kioski, różnorodność, parking. Mnoży liczbę gości (0,45–1,55 raza). Tempo stroi się stałymi na górze `game.js` oraz w `spawnEvery` i `buildTime`.
- Choroby: po 90 s głodu albo rzadko losowo (od 3 wybiegów). Weterynarz ma 2 miejsca i leczy 40 s; karetka zabiera zwierzę sama. Bez wolnego miejsca po 75 s przyjeżdża policja i zabiera zwierzę.
- Parking: za drogą, działka 5, 9, 13… monet + budowa 12. Przy drodze są 4 miejsca, każdy parking daje 8. Gdy brak miejsc, kierowcy się denerwują i zadowolenie spada.
- Śmietnik (przycisk w lewym dolnym rogu, 5 monet): stoi na ścieżce, w promieniu 2 pól goście nie śmiecą.
- Parking (od 2026-11-09): każdy gotowy parking podnosi limit gości o 5 (`PARK_GUESTS`) i skraca odstęp między gośćmi o 15% (`PARK_RATE`).
- Śmietnik: gdy leżą co najmniej 2 śmieci, a śmietnika nie ma, przycisk świeci; przy 3 śmieciach dłoń wskazuje przycisk.
- Pracownicy (karty w panelu budowy): Opiekun (karmi, łapie uciekinierów), Sprzątacz (śmieci), Dostawca (kioski). Pracują na swojej działce
  i 8 sąsiednich, ruszają, gdy dziecko nie zdąży w 6 s, potrzebują ścieżki do domku. Pensja 2 monety co 90 s (bez monet – za darmo).
  Dotknięcie domku podświetla zasięg.
- Atrakcje: Ogród, Fontanna, Plac zabaw, Karuzela (płaci 2), Akwarium (płaci 3). Przyciągają gości i podnoszą zadowolenie (razem do +14).
- Ulepszanie wybiegu: dotknięcie zdrowego wybiegu pokazuje złotą strzałkę z ceną (60% ceny zwierzęcia × poziom), 2 poziomy (piłka i pień, potem platforma i flaga).
  Poziom zwiększa przyciąganie o 35%, przyspiesza młode i pozwala na więcej młodych.
- Młode: zadbane zwierzę po ~200 s ma młode (najwyżej 1 + poziom wybiegu); młode chodzi przy mamie i przyciąga gości.
- Pokazy: co 1,5–2,5 min nad wybiegiem (foka, małpa, słoń, pingwin, kangur, niedźwiedź, żyrafa, lew) dzwoni dzwonek; dotknięcie = 8 s pokazu, widzowie i monety. Bez dotknięcia dzwonek znika bez kary.
- Ucieczka: rzadko małe zwierzę chodzi po ścieżkach (zadowolenie −8). Dotknięcie łapie je (+3 monety), opiekun w pobliżu łapie je sam, po 75 s wraca samo.
- Doba 6 min: noc ~1/5 czasu (ciemniej, latarnie, zwierzęta śpią i nie głodnieją, mniej gości). Deszcz co 3–5 min przez ~45 s (parasole, mniej gości), potem tęcza.
- Wycieczka szkolna: co 4–6 min (od 4 zwierząt, zadowolenie ≥ 35, w dzień i bez deszczu) autobus z 6 osobami; po wizycie premia 10 + zadowolenie/10.
- Burzenie (młotek w lewym dolnym rogu): pierwsze dotknięcie zaznacza budynek i pokazuje zwrot, drugie burzy. Wraca 50% ceny, a 80% gdy budowa jeszcze trwa. Lecznicy z pacjentami nie da się zburzyć.
- Mapy: 4 (`MAPS` w `game.js`), kolejna odblokowuje się po osiągnięciu celu (liczba różnych zwierząt i kiosków + zadowolenie). Każda mapa ma własne zoo i monety.
- Zapis: 4 sloty w `localStorage` (`zoo.slot.v3.N`), zapis automatyczny i przycisk dyskietki. Stary `zoo.save.v2/v1` trafia do slotu 1. Slot kasuje przytrzymanie krzyżyka przez 2,5 s.

Przed publikacją: repo, `games.js` w launcherze oraz w `index.html` przed `</body>`:
`window.gryHomeVisible = () => !window.__zoo || window.__zoo.S.scene === 'title';` i `<script src="/home.js" data-corner="tl" defer></script>`.

Grafika 3D (od 2026-11-10): wszystkie zwierzęta, wybiegi (po jednym na biom, żyrafa ma własny), kioski, domki pracowników,
lecznica i atrakcje to modele z Meshy wyrenderowane do `sprites/` (7,6 MB). Od 2026-11-10 także brama, drzewa, skały, śmietnik, plac budowy i tekstury terenu (`tools/tekstury.py`: trawa, bruk, asfalt, piach, błoto, woda).
Tabliczki z ceną: deska 3D, cena i moneta rysowane kodem na desce (pochylenie 0,43). Rysowane kodem zostały: ludzie, auta, menu i okienka.
Płynność: gdy klatki są wolniejsze niż ~40 kl./s przez 2 s, gra obniża rozdzielczość rysowania (`DPR_CAP` w `game.js`).
1. Wybiegi i budynki: `python tools/meshy.py koncept <wzór.png> <nazwa> "<opis>"` (obrazek w stylu wybiegu żyrafy, ok. 9 kredytów),
   potem `python tools/meshy.py obraz models/<nazwa>/koncept.png <model>` (ok. 30). Zwierzęta: `tekst "<opis>" <nazwa>` albo `tools/meshy_batch.py`.
2. `python tools/build3d.py [klucze]` renderuje wg `tools/render_all.json` (obrót, wielkość `fill`, woda `pool`, przeszkody `block`)
   i zapisuje arkusze + `sprites/index.js`. Potrzebny serwer gry i Playwright (`NODE_PATH`). `--podglad` = szybki podgląd obrotu zwierząt.
   Ruch zwierząt jest proceduralny (Meshy rigguje tylko postacie dwunożne); opcje: swing, pace, biped, legs, wave, waddle, tail, legZ.
3. Gra używa grafiki 3D, gdy jest wpis w `sprites/index.js`; `?stary` w adresie pokazuje dawną grafikę.
`models/` (344 MB, modele źródłowe) nie trafia do repo ani do publikacji – tylko `sprites/`.
