# 🏛️ PoliticGacha

Ein Gacha-Spiel im Stil von *Wiki Gacha*, nur mit Politikern. Du ziehst Staatsfrauen und Staatsmänner aus 2.500 Jahren Geschichte aus Packs, schmiedest daraus **Allianzen** und schickst sie in eine **vereinfachte Top-Down-Kriegssimulation**: gegen die KI oder gegen deine Freunde.

## Spielen

▶️ **Online spielen:** https://linovallebuona.github.io/PoliticGacha/

(Jeder Push auf `main` wird per GitHub Actions automatisch veröffentlicht, siehe `.github/workflows/pages.yml`.)

Es gibt keinen Build-Schritt und keine Abhängigkeiten. Öffne einfach `index.html` im Browser oder hoste den Ordner statisch, zum Beispiel über GitHub Pages:

```bash
python3 -m http.server 8000   # dann http://localhost:8000
```

Der Spielstand liegt im `localStorage` des Browsers.

## Features

- **92 Politiker** in 4 Seltenheiten (Gewöhnlich, Selten, Episch, Legendär), 4 Regionen, 5 Epochen und 5 Truppenklassen.
- **Wikipedia-Anbindung**: Porträts und Kurzbiografien werden live aus der deutschen Wikipedia geladen (REST-API) und gecacht. Offline funktionieren die Karten trotzdem, dann mit Initialen.
- **Packs**: Wahlkampf-, Koalitions-, Regional- und Epochen-Pack, dazu ein Pity-System (Legendär spätestens nach 60 Zügen) und ein täglicher Bonus.
- **Duplikate** steigern das Level (bis Level 5, je +8 % Werte). Bei Max-Level gibt es Stimmen zurück.
- **Allianzen** aus bis zu 5 Politikern mit Synergien:
  - gleiche Region → mehr Rückhalt (HP)
  - gleiche Epoche → mehr Angriff
  - 4+ verschiedene Klassen → mehr Tempo und schnellere Fähigkeiten
  - 3+ gleiche Klasse → Doktrin-Bonus
- **Schlacht**: Jeder Politiker führt ein Bataillon. Die Truppen kämpfen um drei Städte und den gegnerischen Regierungssitz. Wälder geben Deckung, Hügel mehr Reichweite. Fällt der Anführer, *tritt er zurück*.

| Klasse | Fähigkeit | stark gegen |
|---|---|---|
| 🪖 Infanterie | Mobilmachung (Verstärkung) | 🐎 |
| 🛡️ Panzer | Bollwerk (−60 % Schaden) | 🪖 🐎 |
| 💥 Artillerie | Sperrfeuer (Granatsalve) | 🛡️ 🪖 |
| 🐎 Schnelle Brigade | Blitzangriff | 💥 🕊️ |
| 🕊️ Diplomatie | Verhandlungen (Waffenstillstand + Heilung) | – |

## Gegen Freunde spielen

1. **Live (online)**: Einer erstellt unter *Schlacht → Live gegen Freunde* einen Raum und teilt den 5-stelligen Code oder den Einladungslink. Beide stellen verdeckt auf und schauen dieselbe Schlacht live. Die Verbindung läuft Peer-to-Peer über WebRTC ([PeerJS](https://peerjs.com), liegt in `js/vendor`). Nur der Verbindungsaufbau nutzt den öffentlichen PeerJS-Server.
2. **Freundes-Code**: Ihr tauscht eure Allianz-Codes, zum Beispiel per Messenger, und fügt den Code des anderen ein. Die Simulation ist **deterministisch**, deshalb sehen beide exakt dieselbe Schlacht.

## Technik

```
index.html
css/style.css
js/data.js         Politiker, Klassen, Synergien
js/util.js         Seeded RNG, Codes, DOM-Helfer
js/wiki.js         Wikipedia-Porträts & Auszüge (Cache)
js/state.js        Spielstand, Packs, Allianzen
js/battle-sim.js   Deterministische Simulation (fester Zeitschritt, keine Trigonometrie)
js/battle-view.js  Canvas-Renderer & Aufstellungs-Editor
js/net.js          PeerJS-Anbindung
js/ui.js           Packs, Sammlung, Allianzen
js/battle-ui.js    Schlacht-Menü, Aufstellung, HUD, Ergebnis, Lobby
js/main.js         Start
```

**Neue Politiker** trägst du in `RAW` in `js/data.js` ein: `[id, Name, Wikipedia-Titel, Flagge, Region, Ära, Klasse, Seltenheit, Amt]`. Die Werte werden automatisch aus Seltenheit und Klasse abgeleitet.

*Satirisches Spiel. Die Karten sagen nichts über die realen Personen aus.*
