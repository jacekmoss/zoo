"""Lektor "Moje Zoo" z ElevenLabs: zdania z game.js -> pliki mp3 w audio/.

Klucz API: zmienna ELEVENLABS_API_KEY albo plik ~/.elevenlabs_key (nigdy w repo).

Użycie (z folderu gry/zoo):
  py tools/glos.py frazy                 # tylko pokaż listę zdań i liczbę znaków
  py tools/glos.py probki OUT_DIR        # próbki kilku głosów do wyboru
  py tools/glos.py generuj VOICE_ID      # wygeneruj brakujące mp3 + audio/manifest.json
  py tools/glos.py generuj VOICE_ID --od-nowa   # wszystko od nowa (np. po zmianie głosu)
  py tools/glos.py generuj VOICE_ID --pomin REGEX  # pomiń zdania pasujące do wzorca

Gra (say) szuka najpierw całego zdania w manifest.json, potem pojedynczych
zdań/fragmentów; gdy czegoś brak, mówi głosem przeglądarki.
"""
import hashlib, json, os, re, sys, time, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / 'audio'
MODEL = 'eleven_multilingual_v2'
SETTINGS = {'stability': 0.55, 'similarity_boost': 0.8, 'style': 0.15, 'use_speaker_boost': True}

GLOS = 'ASTUQY0HwelFAKtXlaJ2'  # wybrany: Weronika - Storyteller (2026-11-07)

PROBKI = {  # polskie głosy z biblioteki ElevenLabs
    'weronika': 'ASTUQY0HwelFAKtXlaJ2',   # Weronika - Storyteller (ciepły, kobiecy)
    'joanna':   'H3IcxEgdFxIEJAqMc0Bc',   # Joanna - Pure, Clear, Welcoming
    'damian':   'S1JKkpuAQNsowB8ZvKRO',   # Damian - Pleasant Fairytale Narrator
    'tomasz':   'xsSg7GkDPDhaGZpbKOLn',   # Tomasz Z - głos z bajek (starszy)
}
TEKST_PROBKI = ('To twoje zoo. Dotknij tabliczki i kup działkę. '
                'Hura! Żyrafa! Gość bardzo się cieszy i daje dużo monet. '
                'Mniam! Pingwin jest najedzony.')


def key():
    k = os.environ.get('ELEVENLABS_API_KEY')
    if not k:
        p = Path.home() / '.elevenlabs_key'
        k = p.read_text().strip() if p.exists() else ''
    if not k:
        sys.exit('Brak klucza: ustaw ELEVENLABS_API_KEY albo ~/.elevenlabs_key')
    return k


def tts(text, voice, out):
    body = json.dumps({'text': text, 'model_id': MODEL, 'voice_settings': SETTINGS,
                       'language_code': 'pl'}).encode()
    url = f'https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_96'
    for attempt in range(4):
        req = urllib.request.Request(url, data=body, method='POST', headers={
            'xi-api-key': key(), 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
        try:
            data = urllib.request.urlopen(req, timeout=60).read()
            Path(out).write_bytes(data)
            return
        except urllib.error.HTTPError as e:
            msg = e.read()[:300].decode('utf-8', 'replace')
            if e.code == 429 or e.code >= 500:
                time.sleep(3 * (attempt + 1)); continue
            if e.code == 400 and 'language_code' in msg:   # model bez language_code
                body = json.dumps({'text': text, 'model_id': MODEL, 'voice_settings': SETTINGS}).encode()
                continue
            sys.exit(f'Błąd API {e.code}: {msg}')
    sys.exit('API nie odpowiada (za dużo prób)')


def norm(t):
    return re.sub(r'\s+', ' ', t).strip()


LIT = r"'((?:[^'\\]|\\.)*)'"


def zdania(t):
    """Tekst -> zdania; ten sam podział robi gra przy odtwarzaniu."""
    return [norm(s) for s in re.split(r'(?<=[.!?:])\s+', norm(t)) if norm(s)]


def frazy():
    """Zdania z game.js: wywołania say/sayHint/sayOnce zamienione na szablony,
    {N} = nazwa zwierzęcia/kiosku (wszystkie), {X} = liczba gwiazdek 0..20."""
    src = (ROOT / 'game.js').read_text(encoding='utf-8')
    names = sorted(set(re.findall(r"\b[A-Z]\('([^']+)',\s*\d", src)))
    templates = set()
    for line in src.splitlines():
        for m in re.finditer(r"\b(say|sayHint|sayOnce)\(", line):
            arg = line[m.end():]
            if m.group(1) == 'sayOnce':
                arg = re.sub(r"^\s*'[a-z]+'\s*,\s*", '', arg)
            # do końca argumentu: pierwszy ',' lub ')' poza literałami i nawiasami
            depth, i, out = 0, 0, ''
            while i < len(arg):
                c = arg[i]
                if c == "'":
                    j = arg.index("'", i + 1); out += arg[i:j + 1]; i = j + 1; continue
                if c in '([': depth += 1
                if c in ')]':
                    if depth == 0: break
                    depth -= 1
                if c == ',' and depth == 0: break
                out += c; i += 1
            if "'" not in out:
                continue  # np. say(t.say) – same nazwy, dodane niżej
            parts = re.split(LIT, out)
            tpl = ''
            for k, p in enumerate(parts):
                if k % 2: tpl += p
                elif p.strip(' +()'):
                    tpl += '{N}' if '.say' in p else '{X}'
            templates.add(tpl)
    animals = sorted(set(re.findall(r"\bA\('([^']+)',\s*\d", src)))
    out = set(names) | {n + '!' for n in names}
    # stany zwierząt z rodzajem (jak fem() w grze: nazwa na -a = rodzaj żeński)
    for n in animals:
        f = n.endswith('a')
        out |= {f"{n} jest {'głodna' if f else 'głodny'}.", f"{n} jest {'najedzona' if f else 'najedzony'}."}
    for tpl in templates:
        if '{X}' in tpl and 'gwiazd' in tpl and 'Masz' in tpl:
            for i in range(0, 21):
                g = 'gwiazdkę' if i == 1 else 'gwiazdki' if i % 10 in (2, 3, 4) and i % 100 not in (12, 13, 14) else 'gwiazdek'
                out |= set(zdania(tpl.replace('{X}', str(i), 1).replace('{X}', g, 1)))
            continue
        for s in zdania(tpl):
            if re.search(r'jest (głodn|najedzon)', s):
                continue  # dodane wyżej, z rodzajem
            if '{X}' in s:
                continue  # zlepki składane w kodzie (np. lista nowości) – gra mówi je z kawałków
            if '{N}' in s:
                out |= {s.replace('{N}', n) for n in names}
            else:
                out.add(s)
    out |= {'Nowa gwiazdka!', 'Nowe zwierzęta:', 'Nowy kiosk:'}
    return sorted(x for x in out if re.search(r'[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]', x))


def fname(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:12] + '.mp3'


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd = sys.argv[1]
    if cmd == 'frazy':
        f = frazy()
        for t in f: print(t)
        print(f'--- {len(f)} zdań, {sum(map(len, f))} znaków')
    elif cmd == 'probki':
        out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
        for name, vid in PROBKI.items():
            tts(TEKST_PROBKI, vid, out / f'{name}.mp3'); print('ok', name)
    elif cmd == 'generuj':
        voice = sys.argv[2]; fresh = '--od-nowa' in sys.argv
        AUDIO.mkdir(exist_ok=True)
        mf = AUDIO / 'manifest.json'
        man = {} if fresh or not mf.exists() else json.loads(mf.read_text(encoding='utf-8'))
        if man.get('_voice') not in (None, voice):
            sys.exit('manifest ma inny głos – użyj --od-nowa')
        skip = re.compile(sys.argv[sys.argv.index('--pomin') + 1]) if '--pomin' in sys.argv else None
        todo = [t for t in frazy() if (t not in man or not (AUDIO / man[t]).exists()) and not (skip and skip.search(t))]
        print(f'do wygenerowania: {len(todo)} zdań, {sum(map(len, todo))} znaków')
        for i, t in enumerate(todo, 1):
            tts(t, voice, AUDIO / fname(t)); man[t] = fname(t)
            man['_voice'] = voice
            mf.write_text(json.dumps(man, ensure_ascii=False, indent=0), encoding='utf-8')
            print(f'{i}/{len(todo)} {t}')
        print('gotowe:', mf)
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
