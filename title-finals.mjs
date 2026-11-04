// يحدد النهائيات التي فاز بها ناديٌ فعلاً: نهائي بمباراة واحدة، أو ذهاب وإياب (يُجمع المجموع).
// games: مباريات الأندية (id, label, round, when, opp, gf, ga, won, key, official)؛ finals: النهائيات القادمة (label, when, name)
export function titleFinals(games, finals) {
  const out = [];
  const by = {};
  (games || []).forEach((g) => {
    if (g.key === 'league' || g.official === false || !/^final$/i.test(g.round || '')) return;
    (by[g.id + '|' + g.label] = by[g.id + '|' + g.label] || []).push(g);
  });
  Object.keys(by).forEach((k) => {
    const list = by[k].slice().sort((a, b) => a.when - b.when);
    const ties = [];
    list.forEach((g) => {
      const t = ties.find((x) => x[0].opp === g.opp && g.when - x[x.length - 1].when < 14 * 86400000);
      if (t) t.push(g);
      else ties.push([g]);
    });
    ties.forEach((t) => {
      const last = t[t.length - 1];
      // مباراة الإياب لم تُلعب بعد: لا لقب حتى تنتهي
      const pending = (finals || []).some((f) => f.label === last.label && f.when > last.when && f.when - last.when < 14 * 86400000 && (!f.name || !last.opp || String(f.name).indexOf(last.opp) >= 0));
      if (pending) return;
      let won;
      if (t.length === 1) won = last.won === true;
      else {
        const a = t.reduce((s, g) => s + g.gf, 0);
        const b = t.reduce((s, g) => s + g.ga, 0);
        won = a > b ? true : a < b ? false : last.won === true; // تعادل المجموع: نعتمد علامة الفائز (ركلات الجزاء) وإلا لا لقب
      }
      if (won) out.push(last);
    });
  });
  return out;
}
