/* Online-Mehrspieler über PeerJS (WebRTC, Peer-to-Peer).
 * Es werden nur Armeen + Seed ausgetauscht – beide Geräte simulieren
 * dieselbe deterministische Schlacht.
 */
const Net = (() => {
  const PREFIX = 'politicgacha-v1-';
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let peer = null, conn = null, role = null, code = null, handlers = {};

  const emit = (type, ...a) => handlers[type] && handlers[type](...a);
  const genCode = () => Array.from({ length: 5 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join('');

  function attach(c) {
    conn = c;
    c.on('open', () => emit('open'));
    c.on('data', (d) => emit('message', d));
    c.on('close', () => { if (conn === c) { conn = null; emit('close'); } });
    c.on('error', (e) => emit('error', e));
  }

  function available() { return typeof Peer !== 'undefined'; }

  function host() {
    close();
    if (!available()) { emit('error', new Error('PeerJS konnte nicht geladen werden.')); return; }
    role = 'host';
    code = genCode();
    peer = new Peer(PREFIX + code, { debug: 0 });
    peer.on('open', () => emit('hosting', code));
    peer.on('connection', (c) => {
      if (conn && conn.open) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; }
      attach(c);
    });
    peer.on('error', (e) => { if (e.type === 'unavailable-id') host(); else emit('error', e); });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch {} });
  }

  function join(c) {
    close();
    if (!available()) { emit('error', new Error('PeerJS konnte nicht geladen werden.')); return; }
    role = 'guest';
    code = String(c).toUpperCase().replace(/[^A-Z0-9]/g, '');
    peer = new Peer({ debug: 0 });
    peer.on('open', () => attach(peer.connect(PREFIX + code, { reliable: true })));
    peer.on('error', (e) => emit('error', e));
  }

  function send(msg) { if (conn && conn.open) conn.send(msg); }
  function close() {
    const c = conn, p = peer;
    conn = null; peer = null;
    try { c && c.close(); } catch {}
    try { p && p.destroy(); } catch {}
  }

  return {
    on(h) { handlers = h; },
    host, join, send, close, available,
    get role() { return role; },
    get code() { return code; },
    get connected() { return !!(conn && conn.open); },
  };
})();

function netErrorText(e) {
  const map = {
    'peer-unavailable': 'Raum nicht gefunden – stimmt der Code?',
    'network': 'Keine Verbindung zum Vermittlungsserver.',
    'server-error': 'Der Vermittlungsserver ist nicht erreichbar.',
    'browser-incompatible': 'Dein Browser unterstützt kein WebRTC.',
    'socket-error': 'Verbindung zum Vermittlungsserver unterbrochen.',
  };
  return (e && map[e.type]) || (e && e.message) || 'Unbekannter Verbindungsfehler';
}
