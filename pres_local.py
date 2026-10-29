# Local-language (es/it/de/fr/pt) president-change headline patterns + sources for the European watcher.
import re, unicodedata
from pres_watch import rss, gnews, host_of

def fold(s):
    s = unicodedata.normalize('NFKD', s or '')
    return re.sub(r'\s+', ' ', ''.join(c for c in s if not unicodedata.combining(c)).lower()).strip()

LOCAL_SRC = ['marca.com', 'as.com', 'mundodeportivo.com', 'sport.es', 'elpais.com', 'elmundo.es', 'abc.es', 'lavanguardia.com', 'relevo.com', 'cadenaser.com', 'rtve.es', 'efe.com', 'europapress.es', 'elperiodico.com', 'diariodesevilla.es', 'superdeporte.es', 'estadiodeportivo.com', 'elcorreo.com', 'lavozdegalicia.es', 'faro.vigo.es', 'levante-emv.com', 'lavozdeasturias.es', 'noticiasdenavarra.com', 'deia.eus', 'diariovasco.com',
 'gazzetta.it', 'corriere.it', 'corrieredellosport.it', 'tuttosport.com', 'repubblica.it', 'ansa.it', 'calciomercato.com', 'tuttomercatoweb.com', 'sport.sky.it', 'sky.it', 'ilmessaggero.it', 'lastampa.it', 'ilsole24ore.com', 'goal.com', 'fiorentina.it', 'sportmediaset.mediaset.it', 'ilmattino.it', 'dazn.com',
 'kicker.de', 'bild.de', 'sportschau.de', 'spiegel.de', 'sport1.de', 'transfermarkt.de', 'faz.net', 'sueddeutsche.de', 'zeit.de', 'ran.de', 'tagesschau.de', 'sky.de', 'fupa.net', 'welt.de', 'mopo.de', 'weser-kurier.de', 'ksta.de', 'rp-online.de', 'merkur.de', 'abendblatt.de',
 'lequipe.fr', 'lemonde.fr', 'footmercato.net', 'rmcsport.bfmtv.com', 'francetvinfo.fr', 'ouest-france.fr', 'sofoot.com', 'lefigaro.fr', 'leparisien.fr', 'actu.fr', 'nicematin.com', 'laprovence.com', 'midilibre.fr', 'ladepeche.fr', 'republicain-lorrain.fr', 'dna.fr', 'lavoixdunord.fr', 'lyonne.fr', 'letelegramme.fr', 'sudouest.fr', 'foot01.com', 'eurosport.fr', 'canalplus.com',
 'record.pt', 'abola.pt', 'ojogo.pt', 'maisfutebol.iol.pt', 'publico.pt', 'dn.pt', 'sapo.pt', 'cmjornal.pt']

LOCAL_FEEDS = ['https://www.gazzetta.it/rss/home.xml', 'https://www.calciomercato.com/feed', 'https://www.tuttomercatoweb.com/rss/', 'https://newsfeed.kicker.de/news/aktuell', 'https://www.sportschau.de/fussball/index~rss2.xml', 'https://www.footmercato.net/flux-rss', 'https://www.sofoot.com/rss.xml', 'https://www.foot01.com/rss.xml', 'https://e00-marca.uecdn.es/rss/portada.xml', 'https://as.com/rss/tags/ultimas_noticias.xml', 'https://www.mundodeportivo.com/rss/futbol', 'https://www.sport.es/es/rss/futbol/rss.xml', 'https://www.record.pt/rss', 'https://www.abola.pt/rss']

LOCAL_QUERIES = {
 'es': ['nuevo presidente del club fútbol', 'dimite el presidente del club fútbol', 'elegido presidente club fútbol elecciones', 'nombrado presidente del club fútbol oficial'],
 'it': ['nuovo presidente del club calcio', 'si dimette il presidente calcio', 'eletto presidente società calcio ufficiale', 'dimissioni presidente club calcio'],
 'de': ['neuer Präsident Fußballverein gewählt', 'Präsident Rücktritt Fußball Verein', 'zum neuen Präsidenten gewählt Fußball', 'Vereinspräsident tritt zurück'],
 'fr': ['nouveau président du club football', 'démission du président du club football', 'élu président du club football officiel', 'président démissionne club football'],
 'pt': ['novo presidente do clube futebol', 'demissão presidente clube futebol', 'eleito presidente clube futebol'],
}
LOCAL_SITES = {'es': ['marca.com', 'as.com', 'mundodeportivo.com', 'sport.es'], 'it': ['gazzetta.it', 'corrieredellosport.it', 'tuttosport.com', 'sport.sky.it'], 'de': ['kicker.de', 'sportschau.de', 'bild.de', 'spiegel.de'], 'fr': ['lequipe.fr', 'footmercato.net', 'sofoot.com', 'rmcsport.bfmtv.com'], 'pt': ['record.pt', 'abola.pt', 'ojogo.pt']}

NAME = r"(?-i:(?P<n>[A-ZÀ-Ý][\w\.\'’\-À-ÿ]+(?:\s+(?:de|di|da|van|von|der|del|la|le|bin|al|el|do|dos|du|des)?\s*[A-ZÀ-Ý][\w\.\'’\-À-ÿ]+){1,3}))"
PRES = r'(?:presidente|presidenta|président|présidente|präsident|präsidentin|presidenza)'
NEW_CUE = r'(?:nuevo presidente|nueva presidenta|nuevo presidente del|elegido presidente|elegida presidenta|nombrado presidente|nuovo presidente|nuova presidente|eletto presidente|nominato presidente|neuer präsident|neue präsidentin|neuen präsidenten|nouveau président|nouvelle présidente|élu président|élue présidente|nommé président|novo presidente|nova presidente|eleito presidente)'
NOT_FINAL = r'(?i)\b(podría|podrá|según|se perfila|candidat[oa]s?|candidatura|posible|rumor\w*|sueña|quiere|apunta|será|serán|estudia|valora|potrebbe|verso|ipotesi|pronto|sarà|vorrebbe|tentazione|könnte|soll|gerücht\w*|wird|will|kandidat\w*|pourrait|rumeur\w*|serait|sera|vers|envisage|veut|poderá|poderia|querem|quer|candidatos?)\b|\?'
OFFICIAL = r'(?i)\b(oficial\w*|elegid[oa]|nombrad[oa]|confirma\w*|anuncia\w*|proclamad[oa]|ufficial\w*|elett[oa]|nominat[oa]|annuncia\w*|offiziell\w*|gewählt|ernannt|bestätigt|mitgliederversammlung|officiel\w*|élu\w*|nommé\w*|confirmé\w*|eleit[oa]|oficializ\w*)\b'
COACH = r'(?i)\b(rugby|basket\w*|baloncesto|pallacanestro|handball|hockey|volley\w*|tennis|ciclismo|laliga|la liga|ligue 1|bundesliga|serie a|premier league|régulateur|regulador|regolatore|entrenador|técnico|allenatore|mister|trainer|entraîneur|treinador|director deportivo|direttore sportivo|sportdirektor|sportvorstand|directeur sportif|vicepresidente|vice-président|vizepräsident|vice-presidente|federación|federazione|verband|fédération|federação|liga|lega|fifa|uefa|capitán|capitano|kapitän|jugador|giocatore|spieler|joueur)\b'
RESIGN = r'(?i)\b(dimite|dimisión|renuncia|dimitió|si dimette|dimissioni|dimesso|rücktritt|tritt zurück|zurückgetreten|démission\w*|quitte la présidence|demite-se|demissão|demitiu)\b'

def extract_local(title, clubs):
    if ' - ' in title: title = title.rsplit(' - ', 1)[0]
    if ' | ' in title: title = title.split(' | ')[0]
    if re.search(NOT_FINAL, title): return []
    out = []
    for key, aliases in clubs:
        cr = '(?:' + '|'.join(re.escape(a) for a in aliases) + ')'
        cm = re.search(r'\b' + cr + r'\b', title)
        if not cm: continue
        if re.search(RESIGN, title) and re.search(PRES, title, re.I) and not re.search(COACH, title):
            ok = re.search(PRES + r"\s+(?:del|della|dello|de la|de l'|de|du|des|von|do|da|di|d')\s*" + cr + r'\b', title, re.I) or re.search(cr + r'\b.{0,25}?' + PRES, title, re.I)
            if ok: out.append((key, 'resign', None, False))
            continue
        if re.search(COACH, title): continue
        m = re.search(NAME + r'\s*[,:–\-]?\s*(?:(?:nommé|nommée|élu|élue|eletto|eletta|nominato|elegido|elegida|nombrado|nombrada|gewählt|ernannt|eleito)\s+)?(?:es\s+el\s+|es\s+|è\s+il\s+|è\s+la\s+|ist\s+|est\s+|foi\s+|é\s+o\s+)?(?:el\s+|il\s+|der\s+|le\s+|o\s+)?(?:' + NEW_CUE + r')', title, re.I) \
            or re.search(r'(?:' + NEW_CUE + r')\s*(?:del|della|dello|dell\'|de|du|des|von|des|do|da|di|al|a)?\s*\b' + cr + r'\b\s*[,:–\-]?\s*' + NAME, title, re.I) \
            or re.search(r'\b' + cr + r'\b\s*[,:–\-]?\s*(?:nombra|elige|nomina|elegge|nomme|ernennt|wählt|élit|nomeia|elege)\s+(?:a\s+|à\s+)?' + NAME + r'\s+(?:como\s+|come\s+|als\s+|comme\s+)?(?:nuevo\s+|nuovo\s+|neuen\s+|nouveau\s+)?' + PRES, title, re.I) \
            or re.search(NAME + r'\s+(?:zum|à la|alla|a la|como|come)\s+(?:neuen\s+)?' + PRES, title, re.I) \
            or re.search(NAME + r'\s+(?:folgt|succède|succede|sucede|sucedeu|übernimmt)\s+[^,:]{0,45}?(?:als\s+präsident|à la présidence|come\s+presidente|como\s+presidente|als\s+neuer\s+präsident|présidence)', title, re.I) \
            or re.search(r'\b' + cr + r'\b[^,:]{0,40}[,:]\s*' + NAME + r'\s*,?\s*(?:nuevo|nuovo|neuer|nouveau|novo)\s+' + PRES, title, re.I)
        if m:
            nm = m.group('n').strip(' .,-')
            bad = {fold(a) for _, al in clubs for a in al}
            if len(nm.split()) >= 2 and fold(nm) not in bad:
                out.append((key, 'appoint', nm, bool(re.search(r'(?i)interin\w*|provisional|reggente|kommissarisch|intérim|provisório', title)), abs(cm.start() - m.start('n'))))
    # several clubs named in one headline: keep the appointment for the club nearest the name only
    ap = [o for o in out if o[1] == 'appoint']
    if len(ap) > 1:
        best = min(ap, key=lambda o: o[4])
        out = [o for o in out if o[1] != 'appoint'] + [best]
    return [o[:4] for o in out]
