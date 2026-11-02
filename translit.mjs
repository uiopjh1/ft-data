// تعريب تقريبي للأسماء اللاتينية (للاعبين بلا اسم عربي في ويكيداتا)
import fs from 'fs';
const DI = [['sch','ش'],['tch','تش'],['ch','تش'],['sh','ش'],['kh','خ'],['th','ث'],['ph','ف'],['gh','غ'],['ck','ك'],['qu','كو'],['dj','ج'],['dzh','ج'],['ts','تس'],['tz','تس'],['zh','ج'],['ng','نغ'],['ll','ل'],['ss','س'],['tt','ت'],['nn','ن'],['mm','م'],['rr','ر'],['ff','ف'],['pp','ب'],['bb','ب'],['dd','د'],['gg','غ'],['kk','ك'],['cc','ك'],['zz','تس']];
const VW = { a: 'ا', e: 'ي', i: 'ي', o: 'و', u: 'و', y: 'ي' };
const CM = { b: 'ب', c: 'ك', d: 'د', f: 'ف', g: 'غ', h: 'ه', j: 'ج', k: 'ك', l: 'ل', m: 'م', n: 'ن', p: 'ب', q: 'ك', r: 'ر', s: 'س', t: 'ت', v: 'ف', w: 'و', x: 'كس', z: 'ز' };
const strip = (s) => { try { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/ł/g, 'l').replace(/đ/g, 'd').replace(/ı/g, 'i'); } catch (e) { return s; } };
function word(w) {
  let s = strip(w).toLowerCase().replace(/[^a-z]/g, ''); if (!s) return '';
  let out = '', i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    let hit = null; for (const [k, v] of DI) if (rest.startsWith(k)) { hit = [k, v]; break; }
    if (hit) { out += hit[1]; i += hit[0].length; continue; }
    const c = s[i], n = s[i + 1];
    if (c === 'c') { out += 'ei y'.includes(n || '#') && n ? 'س' : 'ك'; i++; continue; }
    if (c === 'g' && n && 'ei'.includes(n) && i > 0) { out += 'ج'; i++; continue; }
    if (c in VW) {
      if (c === 'o' && n === 'o') { out += 'و'; i += 2; continue; }
      if (c === 'e' && n === 'e') { out += 'ي'; i += 2; continue; }
      if (c === 'o' && n === 'u') { out += 'و'; i += 2; continue; }
      if (c === 'a' && n === 'i') { out += 'اي'; i += 2; continue; }
      if (c === 'e' && n === 'a') { out += 'ي'; i += 2; continue; }
      if (c === 'i' && n === 'e') { out += 'ي'; i += 2; continue; }
      if (i === 0) { out += c === 'a' ? 'أ' : c === 'e' ? 'إ' : c === 'i' ? 'إ' : c === 'o' ? 'أو' : c === 'u' ? 'أو' : 'ي'; i++; continue; }
      if (i === s.length - 1 && c === 'e') { i++; continue; }
      out += VW[c]; i++; continue;
    }
    out += CM[c] || ''; i++;
  }
  return out.replace(/ااا*/g, 'ا').replace(/ي{3,}/g, 'يي').replace(/و{3,}/g, 'وو');
}
export function tr(name) { return String(name).split(/\s+/).map(word).filter(Boolean).join(' '); }
if (process.argv[1].endsWith('translit.mjs')) {
  if (process.argv[2] === 'test') { for (const n of ['Marco Vanzini', 'Precious Monye Onyabor', 'Aliou Siby Badra', 'Jatto Ceesay', 'Eamonn O\'Keefe', 'George Timiș', 'Rodrigo Fernandes Alflen', 'Joelson Santos Silva', 'Chaudary Muhammad Amjad', 'John Zaki']) console.log(n, '->', tr(n)); }
  else { let n = 0; for (const f of fs.readdirSync('clubs')) { const a = JSON.parse(fs.readFileSync('clubs/' + f)); for (const r of a) if (!/[؀-ۿ]/.test(r[1] || '')) { const t = tr(r[0]); if (t) { r[1] = t; r.length < 6 && (r[5] = 1); n++; } } fs.writeFileSync('clubs/' + f, JSON.stringify(a)); } console.log('translit', n); }
}
