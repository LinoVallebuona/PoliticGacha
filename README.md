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

- **117 Politiker** in 4 Seltenheiten (Gewöhnlich, Selten, Episch, Legendär), 4 Regionen, 5 Epochen, 7 Parteienfamilien und 5 Truppenklassen.
- **Wikipedia-Anbindung**: Porträts und Kurzbiografien werden live aus der deutschen Wikipedia geladen (REST-API) und gecacht. Offline funktionieren die Karten trotzdem, dann mit Initialen.
- **Packs**: Wahlkampf-, Koalitions-, Regional-, Epochen- und **Partei-Pack**, dazu ein Pity-System (Legendär spätestens nach 60 Zügen).
- **Duplikate** steigern das Level (bis Level 5, je +8 % Werte). Bei Max-Level gibt es Stimmen zurück.
- **Allianzen** aus bis zu 5 Politikern mit Synergien:
  - gleiche Region → mehr Rückhalt (HP)
  - gleiche Epoche → mehr Angriff
  - 4+ verschiedene Klassen → mehr Tempo und schnellere Fähigkeiten
  - 3+ gleiche Klasse → Doktrin-Bonus
  - gleiche Parteienfamilie → Fraktionsdisziplin (schnellere Fähigkeiten)
- **Drei Schlachtmodi**:
  - ⚔️ **Gefecht**: klassische Auto-Schlacht um 3 Städte, bis 2:30.
  - 🗺️ **Feldzug**: große Karte mit Fluss und 3 Brücken, 5 befestigte Städte, Nachschublinien, Moral (bei 0 Kapitulation), Verstärkungswellen und politische Comebacks. Bis 7:00.
  - 🎖️ **Kommando**: Du befehligst selbst. Bataillone wählst du per Klick oder mit 1–5 und schickst sie mit einem Klick auf die Karte los. **H** hält die Stellung, **F** lässt sie frei handeln, **Q** löst die Fähigkeit aus. Mit Einfluss setzt du politische Maßnahmen ein: 📢 Propaganda, 🛑 Sanktionen, 🚑 Feldlazarett, ✈️ Luftschlag, 🚚 Reservisten (Tasten Z–B).
- **Kampagne** pro Modus: Die KI baut ihre Allianz passend zu deiner Stärke, sucht Synergien, stellt taktisch auf und wird mit jeder Stufe um 4 % stärker.
- Jeder Politiker führt ein Bataillon. Wälder geben Deckung, Hügel mehr Reichweite. Fällt der Anführer, *tritt er zurück*.

| Klasse | Fähigkeit | stark gegen |
|---|---|---|
| 🪖 Infanterie | Mobilmachung (Verstärkung) | 🐎 |
| 🛡️ Panzer | Bollwerk (−60 % Schaden) | 🪖 🐎 |
| 💥 Artillerie | Sperrfeuer (Granatsalve) | 🛡️ 🪖 |
| 🐎 Schnelle Brigade | Blitzangriff | 💥 🕊️ |
| 🕊️ Diplomatie | Verhandlungen (Waffenstillstand + Heilung) | – |

## Langzeit-Motivation & Stimmen verdienen

Im Tab **🗳️ Wahlkampf** gibt es:
- **💼 Diäten**: passives Einkommen (40 + 3 pro entdecktem Politiker pro Stunde, bis zu 12 h)
- **🎁 Tagesbonus** und **erster Sieg des Tages**
- **📋 Tägliche Aufträge**: 3 wechselnde Aufgaben pro Tag, Bonus für alle drei
- **🏅 Erfolge**: Sammel-Sets pro Partei und Region, Siege, Kampagnenstufen, Karriere …
- **❓ Politik-Quiz „Wer war's?“**: Porträts, maskierte Wikipedia-Auszüge und Ämter erraten

Außerdem:
- **🎯 Übungsgefechte** mit wählbarer Schwierigkeit, damit man auch dann Stimmen verdient, wenn die Kampagne gerade zu schwer ist
- **🏖️ Ruhestand**: Politiker gegen Stimmen abgeben
- **🎓 Karriere-Rang**: Erfahrung aus Schlachten, Packs und Quiz, Aufstiege bringen Stimmen
- **💾 Spielstand-Export/-Import** im Profil (Klick auf den Namen)

## Gegen Freunde spielen

1. **Live (online)**: Einer erstellt unter *Schlacht → Live gegen Freunde* einen Raum und teilt den 5-stelligen Code oder den Einladungslink. Beide stellen verdeckt auf und schauen dieselbe Schlacht live. Die Verbindung läuft Peer-to-Peer über WebRTC ([PeerJS](https://peerjs.com), liegt in `js/vendor`). Nur der Verbindungsaufbau nutzt den öffentlichen PeerJS-Server.
2. **Freundes-Code** (Gefecht & Feldzug): Ihr tauscht eure Allianz-Codes, zum Beispiel per Messenger, und fügt den Code des anderen ein. Wählt ihr denselben Modus, sehen dank der **deterministischen** Simulation beide exakt dieselbe Schlacht.

Im Kommando-Modus online laufen die Befehle beider Spieler per **Lockstep** synchron. Eine Prüfsumme erkennt, falls die Schlacht auf beiden Geräten auseinanderläuft.

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
js/earn.js         Wahlkampf: Diäten, Aufträge, Erfolge, Quiz, Ruhestand
js/battle-ui.js    Schlacht-Menü, Aufstellung, HUD, Ergebnis, Lobby
js/main.js         Start
```

**Neue Politiker** trägst du in `RAW` in `js/data.js` ein: `[id, Name, Wikipedia-Titel, Flagge, Region, Ära, Klasse, Seltenheit, Amt]`. Die Parteienfamilie ergänzt du in `PARTY_GROUPS`. Die Werte werden automatisch aus Seltenheit und Klasse abgeleitet.

*Satirisches Spiel. Die Karten sagen nichts über die realen Personen aus.*
