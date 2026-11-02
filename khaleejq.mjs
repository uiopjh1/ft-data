import fs from 'fs';
const UA = { 'user-agent': 'FT-app-research/1.0 (github.com/uiopjh1/ft-data)', accept: 'application/sparql-results+json' };
const q = `SELECT ?c ?l ?d WHERE { ?c wdt:P17 wd:Q851 . ?c rdfs:label ?l . FILTER(LANG(?l)='en' && (CONTAINS(LCASE(?l),'khaleej') || CONTAINS(LCASE(?l),'khaleeg') || CONTAINS(LCASE(?l),'khalij'))) OPTIONAL { ?c schema:description ?d . FILTER(LANG(?d)='en') } }`;
const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: UA });
const t = await r.text();
fs.writeFileSync('khaleejq.json', JSON.stringify({ status: r.status, body: t.slice(0, 3000) }, null, 1));
