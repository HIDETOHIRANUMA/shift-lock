// Gran's letter, one line per level.
//   text   what she typed (the period key is broken, so no line ends with one: that is your job)
//   under  red underlines ('_' marks a cell). Red ink never shifts.
//   cp     checkpoint cells: pass one and you will drop back in above it
//   notes  pencil notes in the margin: { at: cell, en, ja, below } (+ ten / tja on touch screens)
(function (root) {
  function under(text, from, to) {
    const a = text.indexOf(from);
    const b = to === 'END' ? text.length - 1 : text.indexOf(to, a) + to.length - 1;
    let s = '';
    for (let i = 0; i <= Math.max(b, text.length); i++) s += (i >= a && i <= b) ? '_' : ' ';
    return s.replace(/\s+$/, '');
  }
  const L = [];
  const add = (o) => L.push(o);

  add({
    text: 'hi sora',
    ja: 'そら、元気にしてる？',
    notes: [
      { at: 0, en: '← →  move     space  jump', ja: '← → で移動、スペースでジャンプ', ten: '◀ ▶  move     ⤒  jump', tja: '◀ ▶ で移動、⤒ でジャンプ' },
      { at: 7, en: 'you are the full stop. land here', ja: 'きみがピリオド。ここに着地して', below: true },
    ],
  });
  add({
    text: 'my period key broke',
    ja: 'タイプライターの「.」のキーが折れちゃったの。',
    notes: [
      { at: 3, en: 'every sentence still needs an end', ja: 'それでも、文には終わりがいる' },
      { at: 12, en: 'R  types the line again', ja: 'R で、この行を打ち直す', ten: 'II  menu: type the line again', tja: 'II のメニューで、この行を打ち直せる', below: true },
    ],
  });
  add({
    text: 'but the shift key works, see',
    ja: 'でもシフトキーは動くのよ。ほらね。',
    notes: [
      { at: 17, en: 'hold ⇧ shift: the comma stands up', ja: '⇧シフトを押したまま。カンマが坂になる' },
      { at: 4, en: 'caps lock or L  locks the shift', ja: 'Caps Lock か L で、シフトを固定できる', ten: 'LOCK  locks the shift', tja: 'LOCK で、シフトを固定できる', below: true },
    ],
  });
  add({
    text: 'i got it in 1961, secondhand',
    ja: 'これは1961年に、中古で買ったの。',
    cp: [12],
    notes: [
      { at: 12, en: 'numbers are kinder without shift', ja: '数字は、シフトなしのほうがやさしい' },
      { at: 16, en: 'you can shift in mid-air', ja: 'シフトは空中でも押せる', below: true },
    ],
  });
  add({
    text: 'he worked nights, i wrote -- often',
    ja: 'おじいちゃんは夜勤で、わたしは手紙を書いた。何度も。',
    cp: [18],
    notes: [
      { at: 26, en: 'a dash rides the shift key', ja: 'ダッシュは、シフトといっしょに上下する' },
      { at: 26, en: 'stand on it and shift', ja: '乗ってからシフトしてみて', below: true },
    ],
  });
  add({
    text: 'he underlined  all my typos',
    under: under('he underlined  all my typos', '  all', 'END'),
    ja: 'あの人ったら、わたしの打ちまちがいに全部線を引いたのよ。',
    notes: [
      { at: 13, en: 'red lines are floors', ja: '赤い線は床になる' },
      { at: 19, en: 'tails block the way below. shift tucks them in', ja: '下に伸びた文字は通せんぼ。シフトでひっこむ', below: true },
    ],
  });
  add({
    text: 'we were  happy from 1962 to 2019 -- always',
    under: under('we were  happy from 1962 to 2019 -- always', '  happy', ' --'),
    ja: '1962年から2019年まで、わたしたちは幸せだった。ずっと。',
    cp: [14, 24, 36],
    notes: [
      { at: 20, en: 'with shift, numbers hang down', ja: 'シフト中は、数字がぶら下がる', below: true },
      { at: 33, en: 'shift, then let go: the dash lifts you', ja: 'シフトして離すと、ダッシュが持ち上げてくれる' },
    ],
  });
  add({
    text: 'write me back, ok -- love, gran',
    ja: 'お返事ちょうだいね。おばあちゃんより。',
    cp: [15, 21],
    notes: [],
  });

  root.SLEVELS = L;
  root.SL_UNDER = under;
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis.SLEVELS;
