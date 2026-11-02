/* Wikipedia-Anbindung (wie bei Wiki Gacha): Porträt + Kurzbeschreibung, lokal gecacht */
const Wiki = (() => {
  const KEY = 'politgacha_wiki_v1';
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { cache = {}; }
  const pending = {};
  const images = {}; // id -> HTMLImageElement (für Canvas)
  let queue = [], active = 0;

  function save() { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {} }

  function run() {
    while (active < 4 && queue.length) {
      const job = queue.shift();
      active++;
      job().finally(() => { active--; run(); });
    }
  }

  function get(p) {
    if (cache[p.id]) return Promise.resolve(cache[p.id]);
    if (pending[p.id]) return pending[p.id];
    pending[p.id] = new Promise((resolve) => {
      queue.push(async () => {
        try {
          const url = `https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(p.wiki.replace(/ /g, '_'))}`;
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error(res.status);
          const j = await res.json();
          cache[p.id] = {
            img: (j.thumbnail && j.thumbnail.source) || '',
            extract: j.extract || '',
            url: (j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) || `https://de.wikipedia.org/wiki/${encodeURIComponent(p.wiki)}`,
          };
          save();
          resolve(cache[p.id]);
        } catch (e) {
          resolve({ img: '', extract: '', url: `https://de.wikipedia.org/wiki/${encodeURIComponent(p.wiki.replace(/ /g, '_'))}`, failed: true });
        }
      });
      run();
    });
    return pending[p.id];
  }

  /* Füllt alle Elemente mit data-portrait="id" mit dem Bild */
  function hydrate(root = document) {
    $$('[data-portrait]', root).forEach((node) => {
      if (node.dataset.hydrated) return;
      node.dataset.hydrated = '1';
      const p = POL_BY_ID[node.dataset.portrait];
      if (!p) return;
      get(p).then((info) => {
        if (info.img) {
          node.style.backgroundImage = `url("${info.img}")`;
          node.classList.add('has-img');
        }
      });
    });
  }

  function image(id) {
    if (images[id]) return images[id].complete && images[id].naturalWidth ? images[id] : null;
    const p = POL_BY_ID[id];
    if (!p) return null;
    get(p).then((info) => {
      if (!info.img || images[id]) return;
      const img = new Image();
      img.src = info.img;
      images[id] = img;
    });
    return null;
  }

  return { get, hydrate, image };
})();
