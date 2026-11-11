# Moje Zoo

Tycoon budowy zoo dla czterolatka. Czysty JS bez budowania, świat przez WebGL (`gl2d.js`), grafika z modeli 3D (sekcja „Technika”).

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

## Technika (od 2026-11-11)

Świat rysuje karta graficzna: `gl2d.js` to własna, mała warstwa WebGL 2, która rozumie te same polecenia co płótno 2D
(obrazki, wypełnienia, wzory, przycinanie), więc kod rysowania świata w `game.js` prawie się nie zmienił, a klatka kosztuje
ok. 1–2 ms zamiast 26–200 ms. Napisy, dymki i interfejs zostają na zwykłym płótnie 2D (`#game`) nad światem (`#world`).
`?bezgl` w adresie wyłącza WebGL (stary, wolny sposób, tylko do porównań), `?lekko` wymusza tryb tabletu.

Tryb tabletu włącza się sam (mało pamięci albo ekran do ok. 1400 px): tekstury w połowie rozdzielczości, ok. 100 MB zamiast 400.

Grafika:
- `sprites2/` – klatki z Blendera: 19 zwierząt (chód, postój, jedzenie w 2 kierunkach + odbicia = 4 kierunki, z rzucanym cieniem),
  10 postaci (goście, opiekun, sprzątacz, dostawca, weterynarz, robotnik), 5 pojazdów (auto, SUV, autobus, karetka, radiowóz),
  3 drzewa bez podstawek, portrety do kart (`p_*.webp`). Indeks: `sprites2/index.js` (`window.ZOO_S2`).
- `sprites/` – wybiegi, kioski, budynki, brama, tekstury terenu (render three.js z 2026-11-10, bez zmian).

Jak powstają klatki (Blender 5.3 w katalogu `tools` użytkownika; zmienna środowiskowa `BLENDER` zmienia ścieżkę):
1. Zwierzęta: `python tools/build_animals.py [nazwy] [--podglad]` → `tools/blender/animal.py` wg `tools/blender/animals.json`.
   Szkielet liczony w numpy (nogi wykrywane jako osobne kawałki siatki, kolana przez odwrotną kinematykę, szyja, ogon),
   bez armatury Blendera. Opcje na zwierzę: `h`, `kind` (quad/biped/slider/hopper), `gait` (walk/pace/trot), `stride`, `yaw`, `eatDeg`, `tail`.
2. Postacie: `python tools/meshy.py tekst ...`, potem `python tools/meshy_rig.py <nazwa>` (szkielet + chód z Meshy, 5 kredytów),
   potem `python tools/build_people.py [nazwy]` (`person.py` dla `os_*`, `prop.py` dla `auto_*`).
   Drzewa: `prop.py` z opcjami `h` i `cutBase` (usuwa podstawkę), wynik w `models/t_*`.
3. `python tools/pack2.py [nazwy]` skleja klatki w arkusze `sprites2/`. Podglądy: `renders/podglad2/`.
4. Po każdej zmianie plików gry: `python tools/make_sw.py` (lista plików do działania bez internetu).

Testy: `node tools/probe.js [katalog] [adres]` (płynność i zrzuty na pełnym zoo), `node tools/shot.js [katalog]` (zrzuty ekranów);
oba potrzebują serwera gry i Playwrighta (`NODE_PATH` na `node_modules` z Playwrightem, np. z projektu onko-karta).

Bez internetu: `sw.js` zapisuje przy pierwszym uruchomieniu wszystkie pliki (ok. 12 MB, także czcionkę z `fonts/`).
Na tablecie: otworzyć raz adres gry w Chrome z internetem, „Dodaj do ekranu głównego”, potem działa offline.

Sklep ma zakładki (zwierzęta, kioski, atrakcje, pracownicy). `models/` (ok. 500 MB) nie trafia do repo.
