/* PoliticGacha – Spieldaten
 * Jede Karte: id, Name, Wikipedia-Titel (de), Flagge, Region, Ära, Truppenklasse, Seltenheit, Amt.
 * Werte (ANG/VER/TAK) werden deterministisch aus Seltenheit, Klasse und Name abgeleitet.
 */
const RARITIES = {
  C: { key: 'C', name: 'Gewöhnlich', color: '#9aa4b2', stars: 1, base: 42, weight: 0.58, refund: 10 },
  R: { key: 'R', name: 'Selten',     color: '#3b9eff', stars: 2, base: 56, weight: 0.29, refund: 25 },
  E: { key: 'E', name: 'Episch',     color: '#b06bff', stars: 3, base: 70, weight: 0.105, refund: 60 },
  L: { key: 'L', name: 'Legendär',   color: '#ffb800', stars: 4, base: 84, weight: 0.025, refund: 150 },
};
const RARITY_ORDER = ['C', 'R', 'E', 'L'];

const REGIONS = {
  EU: { name: 'Europa', icon: '🏰', color: '#3b82f6' },
  AM: { name: 'Amerikas', icon: '🗽', color: '#ef4444' },
  AS: { name: 'Asien & Ozeanien', icon: '🏯', color: '#f59e0b' },
  AF: { name: 'Afrika & Nahost', icon: '🏜️', color: '#10b981' },
};

const ERAS = {
  ANT: { name: 'Antike', short: 'Antike' },
  VOR: { name: 'Mittelalter & Renaissance', short: 'Vormoderne' },
  NEU: { name: 'Neuzeit (1700–1900)', short: 'Neuzeit' },
  JH20: { name: '20. Jahrhundert', short: '20. Jh.' },
  JH21: { name: '21. Jahrhundert', short: '21. Jh.' },
};

/* Truppenklassen – Basiswerte pro Soldat */
const CLASSES = {
  inf:  { name: 'Infanterie',  icon: '🪖', hp: 110, atk: 11, range: 55,  speed: 30, cd: 1.0, count: 7, r: 6,
          ability: 'Mobilmachung', abilityDesc: 'Ruft regelmäßig 2 Reservisten an die Front.', abilityCd: 20,
          tilt: { a: 0, v: 4, t: 0 } },
  tank: { name: 'Panzer',      icon: '🛡️', hp: 340, atk: 26, range: 75,  speed: 22, cd: 1.7, count: 3, r: 9,
          ability: 'Bollwerk', abilityDesc: 'Das Bataillon nimmt 5 s lang 60 % weniger Schaden.', abilityCd: 17,
          tilt: { a: 4, v: 10, t: -8 } },
  art:  { name: 'Artillerie',  icon: '💥', hp: 75,  atk: 17, range: 220, speed: 20, cd: 3.0, count: 3, r: 7, splash: 30,
          ability: 'Sperrfeuer', abilityDesc: 'Feuert eine Salve von 5 Granaten auf die dichteste Feindgruppe.', abilityCd: 15,
          tilt: { a: 12, v: -8, t: 2 } },
  cav:  { name: 'Schnelle Brigade', icon: '🐎', hp: 175, atk: 18, range: 20, speed: 60, cd: 0.7, count: 6, r: 6,
          ability: 'Blitzangriff', abilityDesc: '3 s lang doppeltes Tempo und +60 % Angriff.', abilityCd: 14,
          tilt: { a: 2, v: -6, t: 12 } },
  dip:  { name: 'Diplomatie',  icon: '🕊️', hp: 100, atk: 8,  range: 85,  speed: 28, cd: 1.1, count: 4, r: 6, heal: 14,
          ability: 'Verhandlungen', abilityDesc: 'Waffenstillstand: Feinde in der Nähe pausieren 3 s, Verbündete heilen 25 %.', abilityCd: 18,
          tilt: { a: -8, v: 0, t: 10 } },
};
/* Konter-Dreieck: Angreifer-Klasse -> Ziel-Klasse -> Multiplikator */
const COUNTERS = {
  cav: { art: 1.6, dip: 1.3 },
  tank: { inf: 1.3, cav: 1.2 },
  art: { tank: 1.5, inf: 1.1 },
  inf: { cav: 1.35 },
  dip: {},
};

/* [id, Name, Wiki-Titel, Flagge, Region, Ära, Klasse, Seltenheit, Amt] */
const RAW = [
  // ---------- Legendär ----------
  ['caesar', 'Gaius Iulius Caesar', 'Gaius Iulius Caesar', '🏛️', 'EU', 'ANT', 'tank', 'L', 'Diktator von Rom'],
  ['napoleon', 'Napoleon Bonaparte', 'Napoleon Bonaparte', '🇫🇷', 'EU', 'NEU', 'tank', 'L', 'Kaiser der Franzosen'],
  ['lincoln', 'Abraham Lincoln', 'Abraham Lincoln', '🇺🇸', 'AM', 'NEU', 'inf', 'L', '16. US-Präsident'],
  ['mandela', 'Nelson Mandela', 'Nelson Mandela', '🇿🇦', 'AF', 'JH20', 'dip', 'L', 'Präsident Südafrikas'],
  ['gandhi', 'Mahatma Gandhi', 'Mahatma Gandhi', '🇮🇳', 'AS', 'JH20', 'dip', 'L', 'Unabhängigkeitsführer'],
  ['churchill', 'Winston Churchill', 'Winston Churchill', '🇬🇧', 'EU', 'JH20', 'art', 'L', 'Premierminister'],
  ['bismarck', 'Otto von Bismarck', 'Otto von Bismarck', '🇩🇪', 'EU', 'NEU', 'art', 'L', 'Reichskanzler'],
  ['kleopatra', 'Kleopatra VII.', 'Kleopatra VII.', '🇪🇬', 'AF', 'ANT', 'dip', 'L', 'Pharaonin'],
  ['alexander', 'Alexander der Große', 'Alexander der Große', '🏺', 'EU', 'ANT', 'cav', 'L', 'König von Makedonien'],
  ['elisabeth1', 'Elisabeth I.', 'Elisabeth I. (England)', '🏴', 'EU', 'VOR', 'inf', 'L', 'Königin von England'],
  // ---------- Episch ----------
  ['adenauer', 'Konrad Adenauer', 'Konrad Adenauer', '🇩🇪', 'EU', 'JH20', 'inf', 'E', 'Bundeskanzler'],
  ['brandt', 'Willy Brandt', 'Willy Brandt', '🇩🇪', 'EU', 'JH20', 'dip', 'E', 'Bundeskanzler'],
  ['merkel', 'Angela Merkel', 'Angela Merkel', '🇩🇪', 'EU', 'JH21', 'inf', 'E', 'Bundeskanzlerin'],
  ['degaulle', 'Charles de Gaulle', 'Charles de Gaulle', '🇫🇷', 'EU', 'JH20', 'tank', 'E', 'Präsident Frankreichs'],
  ['fdr', 'Franklin D. Roosevelt', 'Franklin D. Roosevelt', '🇺🇸', 'AM', 'JH20', 'art', 'E', '32. US-Präsident'],
  ['washington', 'George Washington', 'George Washington', '🇺🇸', 'AM', 'NEU', 'cav', 'E', '1. US-Präsident'],
  ['bolivar', 'Simón Bolívar', 'Simón Bolívar', '🇻🇪', 'AM', 'NEU', 'cav', 'E', 'Libertador'],
  ['ataturk', 'Mustafa Kemal Atatürk', 'Mustafa Kemal Atatürk', '🇹🇷', 'AF', 'JH20', 'tank', 'E', 'Staatsgründer der Türkei'],
  ['katharina', 'Katharina die Große', 'Katharina II. (Russland)', '🇷🇺', 'EU', 'NEU', 'inf', 'E', 'Zarin'],
  ['friedrich2', 'Friedrich der Große', 'Friedrich II. (Preußen)', '🇩🇪', 'EU', 'NEU', 'tank', 'E', 'König von Preußen'],
  ['mariatheresia', 'Maria Theresia', 'Maria Theresia', '🇦🇹', 'EU', 'NEU', 'inf', 'E', 'Erzherzogin von Österreich'],
  ['augustus', 'Augustus', 'Augustus', '🏛️', 'EU', 'ANT', 'inf', 'E', 'Römischer Kaiser'],
  ['perikles', 'Perikles', 'Perikles', '🏺', 'EU', 'ANT', 'dip', 'E', 'Stratege Athens'],
  ['leekuanyew', 'Lee Kuan Yew', 'Lee Kuan Yew', '🇸🇬', 'AS', 'JH20', 'art', 'E', 'Premierminister Singapurs'],
  ['gorbatschow', 'Michail Gorbatschow', 'Michail Gorbatschow', '🇷🇺', 'EU', 'JH20', 'dip', 'E', 'Generalsekretär der KPdSU'],
  ['kennedy', 'John F. Kennedy', 'John F. Kennedy', '🇺🇸', 'AM', 'JH20', 'cav', 'E', '35. US-Präsident'],
  ['thatcher', 'Margaret Thatcher', 'Margaret Thatcher', '🇬🇧', 'EU', 'JH20', 'tank', 'E', 'Premierministerin'],
  ['richelieu', 'Kardinal Richelieu', 'Armand-Jean du Plessis, duc de Richelieu', '🇫🇷', 'EU', 'VOR', 'art', 'E', 'Erster Minister'],
  ['sunyatsen', 'Sun Yat-sen', 'Sun Yat-sen', '🇨🇳', 'AS', 'JH20', 'cav', 'E', 'Gründervater der Republik China'],
  ['nkrumah', 'Kwame Nkrumah', 'Kwame Nkrumah', '🇬🇭', 'AF', 'JH20', 'cav', 'E', 'Präsident Ghanas'],
  ['nehru', 'Jawaharlal Nehru', 'Jawaharlal Nehru', '🇮🇳', 'AS', 'JH20', 'inf', 'E', 'Premierminister Indiens'],
  // ---------- Selten ----------
  ['schmidt', 'Helmut Schmidt', 'Helmut Schmidt', '🇩🇪', 'EU', 'JH20', 'art', 'R', 'Bundeskanzler'],
  ['kohl', 'Helmut Kohl', 'Helmut Kohl', '🇩🇪', 'EU', 'JH20', 'tank', 'R', 'Bundeskanzler'],
  ['obama', 'Barack Obama', 'Barack Obama', '🇺🇸', 'AM', 'JH21', 'dip', 'R', '44. US-Präsident'],
  ['troosevelt', 'Theodore Roosevelt', 'Theodore Roosevelt', '🇺🇸', 'AM', 'JH20', 'cav', 'R', '26. US-Präsident'],
  ['jefferson', 'Thomas Jefferson', 'Thomas Jefferson', '🇺🇸', 'AM', 'NEU', 'art', 'R', '3. US-Präsident'],
  ['franklin', 'Benjamin Franklin', 'Benjamin Franklin', '🇺🇸', 'AM', 'NEU', 'dip', 'R', 'Gründervater'],
  ['cicero', 'Cicero', 'Marcus Tullius Cicero', '🏛️', 'EU', 'ANT', 'dip', 'R', 'Konsul'],
  ['solon', 'Solon', 'Solon', '🏺', 'EU', 'ANT', 'art', 'R', 'Gesetzgeber Athens'],
  ['metternich', 'Fürst Metternich', 'Klemens Wenzel Lothar von Metternich', '🇦🇹', 'EU', 'NEU', 'dip', 'R', 'Staatskanzler'],
  ['talleyrand', 'Talleyrand', 'Charles-Maurice de Talleyrand-Périgord', '🇫🇷', 'EU', 'NEU', 'art', 'R', 'Außenminister'],
  ['goldameir', 'Golda Meir', 'Golda Meir', '🇮🇱', 'AF', 'JH20', 'tank', 'R', 'Premierministerin Israels'],
  ['indiragandhi', 'Indira Gandhi', 'Indira Gandhi', '🇮🇳', 'AS', 'JH20', 'inf', 'R', 'Premierministerin Indiens'],
  ['juarez', 'Benito Juárez', 'Benito Juárez', '🇲🇽', 'AM', 'NEU', 'inf', 'R', 'Präsident Mexikos'],
  ['ardern', 'Jacinda Ardern', 'Jacinda Ardern', '🇳🇿', 'AS', 'JH21', 'dip', 'R', 'Premierministerin Neuseelands'],
  ['macron', 'Emmanuel Macron', 'Emmanuel Macron', '🇫🇷', 'EU', 'JH21', 'cav', 'R', 'Präsident Frankreichs'],
  ['lula', 'Lula da Silva', 'Luiz Inácio Lula da Silva', '🇧🇷', 'AM', 'JH21', 'inf', 'R', 'Präsident Brasiliens'],
  ['nyerere', 'Julius Nyerere', 'Julius Nyerere', '🇹🇿', 'AF', 'JH20', 'inf', 'R', 'Präsident Tansanias'],
  ['sirleaf', 'Ellen Johnson Sirleaf', 'Ellen Johnson Sirleaf', '🇱🇷', 'AF', 'JH21', 'dip', 'R', 'Präsidentin Liberias'],
  ['ashoka', 'Ashoka', 'Ashoka', '🇮🇳', 'AS', 'ANT', 'tank', 'R', 'Maurya-Kaiser'],
  ['hammurapi', 'Hammurapi', 'Hammurapi I.', '🏺', 'AF', 'ANT', 'art', 'R', 'König von Babylon'],
  ['qinshihuang', 'Qin Shihuangdi', 'Qin Shihuangdi', '🇨🇳', 'AS', 'ANT', 'tank', 'R', 'Erster Kaiser Chinas'],
  ['stresemann', 'Gustav Stresemann', 'Gustav Stresemann', '🇩🇪', 'EU', 'JH20', 'dip', 'R', 'Reichskanzler'],
  ['palme', 'Olof Palme', 'Olof Palme', '🇸🇪', 'EU', 'JH20', 'cav', 'R', 'Ministerpräsident Schwedens'],
  ['havel', 'Václav Havel', 'Václav Havel', '🇨🇿', 'EU', 'JH20', 'cav', 'R', 'Präsident Tschechiens'],
  ['eisenhower', 'Dwight D. Eisenhower', 'Dwight D. Eisenhower', '🇺🇸', 'AM', 'JH20', 'tank', 'R', '34. US-Präsident'],
  ['medici', 'Lorenzo de’ Medici', 'Lorenzo de’ Medici', '🇮🇹', 'EU', 'VOR', 'dip', 'R', 'Stadtherr von Florenz'],
  ['saladin', 'Saladin', 'Saladin', '🏜️', 'AF', 'VOR', 'cav', 'R', 'Sultan von Ägypten und Syrien'],
  // ---------- Gewöhnlich ----------
  ['scholz', 'Olaf Scholz', 'Olaf Scholz', '🇩🇪', 'EU', 'JH21', 'inf', 'C', 'Bundeskanzler'],
  ['merz', 'Friedrich Merz', 'Friedrich Merz', '🇩🇪', 'EU', 'JH21', 'tank', 'C', 'Bundeskanzler'],
  ['schroeder', 'Gerhard Schröder', 'Gerhard Schröder', '🇩🇪', 'EU', 'JH21', 'cav', 'C', 'Bundeskanzler'],
  ['baerbock', 'Annalena Baerbock', 'Annalena Baerbock', '🇩🇪', 'EU', 'JH21', 'dip', 'C', 'Außenministerin'],
  ['habeck', 'Robert Habeck', 'Robert Habeck', '🇩🇪', 'EU', 'JH21', 'art', 'C', 'Vizekanzler'],
  ['kiesinger', 'Kurt Georg Kiesinger', 'Kurt Georg Kiesinger', '🇩🇪', 'EU', 'JH20', 'inf', 'C', 'Bundeskanzler'],
  ['erhard', 'Ludwig Erhard', 'Ludwig Erhard', '🇩🇪', 'EU', 'JH20', 'art', 'C', 'Bundeskanzler'],
  ['heuss', 'Theodor Heuss', 'Theodor Heuss', '🇩🇪', 'EU', 'JH20', 'dip', 'C', 'Bundespräsident'],
  ['weizsaecker', 'Richard von Weizsäcker', 'Richard von Weizsäcker', '🇩🇪', 'EU', 'JH20', 'dip', 'C', 'Bundespräsident'],
  ['fischer', 'Joschka Fischer', 'Joschka Fischer', '🇩🇪', 'EU', 'JH20', 'cav', 'C', 'Außenminister'],
  ['genscher', 'Hans-Dietrich Genscher', 'Hans-Dietrich Genscher', '🇩🇪', 'EU', 'JH20', 'dip', 'C', 'Außenminister'],
  ['reuter', 'Ernst Reuter', 'Ernst Reuter', '🇩🇪', 'EU', 'JH20', 'inf', 'C', 'Regierender Bürgermeister Berlins'],
  ['carter', 'Jimmy Carter', 'Jimmy Carter', '🇺🇸', 'AM', 'JH20', 'dip', 'C', '39. US-Präsident'],
  ['truman', 'Harry S. Truman', 'Harry S. Truman', '🇺🇸', 'AM', 'JH20', 'art', 'C', '33. US-Präsident'],
  ['blair', 'Tony Blair', 'Tony Blair', '🇬🇧', 'EU', 'JH21', 'inf', 'C', 'Premierminister'],
  ['attlee', 'Clement Attlee', 'Clement Attlee', '🇬🇧', 'EU', 'JH20', 'inf', 'C', 'Premierminister'],
  ['ptrudeau', 'Pierre Trudeau', 'Pierre Trudeau', '🇨🇦', 'AM', 'JH20', 'cav', 'C', 'Premierminister Kanadas'],
  ['rutte', 'Mark Rutte', 'Mark Rutte', '🇳🇱', 'EU', 'JH21', 'dip', 'C', 'NATO-Generalsekretär'],
  ['kreisky', 'Bruno Kreisky', 'Bruno Kreisky', '🇦🇹', 'EU', 'JH20', 'dip', 'C', 'Bundeskanzler Österreichs'],
  ['degasperi', 'Alcide De Gasperi', 'Alcide De Gasperi', '🇮🇹', 'EU', 'JH20', 'inf', 'C', 'Ministerpräsident Italiens'],
  ['schuman', 'Robert Schuman', 'Robert Schuman', '🇫🇷', 'EU', 'JH20', 'dip', 'C', 'Außenminister'],
  ['monnet', 'Jean Monnet', 'Jean Monnet', '🇫🇷', 'EU', 'JH20', 'art', 'C', 'Europa-Pionier'],
  ['allende', 'Salvador Allende', 'Salvador Allende', '🇨🇱', 'AM', 'JH20', 'cav', 'C', 'Präsident Chiles'],
  ['mujica', 'José Mujica', 'José Mujica', '🇺🇾', 'AM', 'JH21', 'inf', 'C', 'Präsident Uruguays'],
  ['abe', 'Shinzō Abe', 'Shinzō Abe', '🇯🇵', 'AS', 'JH21', 'art', 'C', 'Premierminister Japans'],
  ['annan', 'Kofi Annan', 'Kofi Annan', '🇬🇭', 'AF', 'JH21', 'dip', 'C', 'UN-Generalsekretär'],
  ['hammarskjoeld', 'Dag Hammarskjöld', 'Dag Hammarskjöld', '🇸🇪', 'EU', 'JH20', 'dip', 'C', 'UN-Generalsekretär'],
  ['walesa', 'Lech Wałęsa', 'Lech Wałęsa', '🇵🇱', 'EU', 'JH20', 'cav', 'C', 'Präsident Polens'],
  ['sadat', 'Anwar as-Sadat', 'Anwar as-Sadat', '🇪🇬', 'AF', 'JH20', 'tank', 'C', 'Präsident Ägyptens'],
  ['kenyatta', 'Jomo Kenyatta', 'Jomo Kenyatta', '🇰🇪', 'AF', 'JH20', 'inf', 'C', 'Präsident Kenias'],
  ['sukarno', 'Sukarno', 'Sukarno', '🇮🇩', 'AS', 'JH20', 'cav', 'C', 'Präsident Indonesiens'],
  ['curtin', 'John Curtin', 'John Curtin', '🇦🇺', 'AS', 'JH20', 'tank', 'C', 'Premierminister Australiens'],
  ['vargas', 'Getúlio Vargas', 'Getúlio Vargas', '🇧🇷', 'AM', 'JH20', 'tank', 'C', 'Präsident Brasiliens'],
  ['nasser', 'Gamal Abdel Nasser', 'Gamal Abdel Nasser', '🇪🇬', 'AF', 'JH20', 'art', 'C', 'Präsident Ägyptens'],
  // ---------- Erweiterung ----------
  ['karl', 'Karl der Große', 'Karl der Große', '👑', 'EU', 'VOR', 'tank', 'L', 'Kaiser des Frankenreichs'],
  ['hatschepsut', 'Hatschepsut', 'Hatschepsut', '🇪🇬', 'AF', 'ANT', 'inf', 'L', 'Pharaonin'],
  ['disraeli', 'Benjamin Disraeli', 'Benjamin Disraeli', '🇬🇧', 'EU', 'NEU', 'art', 'E', 'Premierminister'],
  ['gladstone', 'William Gladstone', 'William Ewart Gladstone', '🇬🇧', 'EU', 'NEU', 'inf', 'E', 'Premierminister'],
  ['mitterrand', 'François Mitterrand', 'François Mitterrand', '🇫🇷', 'EU', 'JH20', 'art', 'E', 'Präsident Frankreichs'],
  ['rabin', 'Jitzchak Rabin', 'Jitzchak Rabin', '🇮🇱', 'AF', 'JH20', 'tank', 'R', 'Premierminister Israels'],
  ['bhutto', 'Benazir Bhutto', 'Benazir Bhutto', '🇵🇰', 'AS', 'JH20', 'cav', 'R', 'Premierministerin Pakistans'],
  ['selassie', 'Haile Selassie', 'Haile Selassie', '🇪🇹', 'AF', 'JH20', 'inf', 'R', 'Kaiser von Äthiopien'],
  ['vdleyen', 'Ursula von der Leyen', 'Ursula von der Leyen', '🇪🇺', 'EU', 'JH21', 'art', 'R', 'Präsidentin der EU-Kommission'],
  ['eleanor', 'Eleanor Roosevelt', 'Eleanor Roosevelt', '🇺🇸', 'AM', 'JH20', 'dip', 'R', 'First Lady & UN-Diplomatin'],
  ['chirac', 'Jacques Chirac', 'Jacques Chirac', '🇫🇷', 'EU', 'JH20', 'tank', 'C', 'Präsident Frankreichs'],
  ['jtrudeau', 'Justin Trudeau', 'Justin Trudeau', '🇨🇦', 'AM', 'JH21', 'cav', 'C', 'Premierminister Kanadas'],
  ['sanchez', 'Pedro Sánchez', 'Pedro Sánchez', '🇪🇸', 'EU', 'JH21', 'inf', 'C', 'Ministerpräsident Spaniens'],
  ['frederiksen', 'Mette Frederiksen', 'Mette Frederiksen', '🇩🇰', 'EU', 'JH21', 'inf', 'C', 'Ministerpräsidentin Dänemarks'],
  ['marin', 'Sanna Marin', 'Sanna Marin', '🇫🇮', 'EU', 'JH21', 'cav', 'C', 'Ministerpräsidentin Finnlands'],
  ['ramaphosa', 'Cyril Ramaphosa', 'Cyril Ramaphosa', '🇿🇦', 'AF', 'JH21', 'dip', 'C', 'Präsident Südafrikas'],
  ['bachelet', 'Michelle Bachelet', 'Michelle Bachelet', '🇨🇱', 'AM', 'JH21', 'inf', 'C', 'Präsidentin Chiles'],
  ['aquino', 'Corazon Aquino', 'Corazon Aquino', '🇵🇭', 'AS', 'JH20', 'cav', 'C', 'Präsidentin der Philippinen'],
  ['brundtland', 'Gro Harlem Brundtland', 'Gro Harlem Brundtland', '🇳🇴', 'EU', 'JH20', 'inf', 'C', 'Ministerpräsidentin Norwegens'],
  ['heinemann', 'Gustav Heinemann', 'Gustav Heinemann', '🇩🇪', 'EU', 'JH20', 'art', 'C', 'Bundespräsident'],
  ['scheel', 'Walter Scheel', 'Walter Scheel', '🇩🇪', 'EU', 'JH20', 'cav', 'C', 'Bundespräsident'],
  ['steinmeier', 'Frank-Walter Steinmeier', 'Frank-Walter Steinmeier', '🇩🇪', 'EU', 'JH21', 'inf', 'C', 'Bundespräsident'],
  ['schaeuble', 'Wolfgang Schäuble', 'Wolfgang Schäuble', '🇩🇪', 'EU', 'JH21', 'art', 'C', 'Bundestagspräsident'],
  ['kelly', 'Petra Kelly', 'Petra Kelly', '🇩🇪', 'EU', 'JH20', 'cav', 'C', 'Mitgründerin der Grünen'],
  ['kretschmann', 'Winfried Kretschmann', 'Winfried Kretschmann', '🇩🇪', 'EU', 'JH21', 'tank', 'C', 'Ministerpräsident Baden-Württembergs'],
];


/* Parteienfamilien – nach Parteizugehörigkeit im wichtigsten Amt (Monarchen & Antike: „Krone, Hof & Senat“) */
const PARTIES = {
  KON: { name: 'Christdemokraten & Konservative', short: 'Konservative', icon: '⚫', color: '#64748b' },
  SOZ: { name: 'Sozialdemokraten & Arbeiterparteien', short: 'Sozialdemokraten', icon: '🔴', color: '#ef4444' },
  LIB: { name: 'Liberale & Demokraten', short: 'Liberale', icon: '🟡', color: '#eab308' },
  GRU: { name: 'Grüne & Bürgerbewegungen', short: 'Grüne & Bewegungen', icon: '🟢', color: '#22c55e' },
  UNA: { name: 'Unabhängigkeits- & Befreiungsbewegungen', short: 'Unabhängigkeit', icon: '🕊️', color: '#06b6d4' },
  KRO: { name: 'Krone, Hof & Senat', short: 'Krone & Senat', icon: '👑', color: '#a855f7' },
  SON: { name: 'Internationale & Sonstige', short: 'Sonstige', icon: '🌐', color: '#94a3b8' },
};
const PARTY_GROUPS = {
  KON: 'lincoln churchill adenauer merkel degaulle thatcher kohl troosevelt eisenhower merz kiesinger erhard weizsaecker degasperi schuman abe disraeli vdleyen chirac schaeuble',
  SOZ: 'brandt schmidt goldameir ardern lula palme scholz schroeder reuter blair attlee kreisky allende mujica curtin mitterrand rabin bhutto sanchez frederiksen marin bachelet brundtland heinemann steinmeier',
  LIB: 'fdr kennedy obama jefferson juarez macron sirleaf stresemann heuss genscher carter truman ptrudeau rutte gladstone eleanor jtrudeau aquino scheel',
  GRU: 'havel baerbock habeck fischer walesa kelly kretschmann',
  UNA: 'mandela gandhi washington bolivar ataturk leekuanyew sunyatsen nkrumah nehru franklin indiragandhi nyerere sadat kenyatta sukarno nasser ramaphosa',
  KRO: 'caesar napoleon bismarck kleopatra alexander elisabeth1 katharina friedrich2 mariatheresia augustus perikles richelieu cicero solon metternich talleyrand ashoka hammurapi qinshihuang medici saladin karl hatschepsut selassie',
  SON: 'gorbatschow monnet annan hammarskjoeld vargas',
};
/* Fraktionsboni: ab 2 Mitgliedern derselben Parteienfamilie (Stufen 2/3/4/5 → 6/12/20/30 %) */
const PARTY_BONUS = {
  KON: { name: 'Stabilität', desc: 'mehr Rückhalt (HP)', apply: (s, b) => (s.hp += b * 1.2), text: (b) => `+${Math.round(b * 120)} % Rückhalt` },
  SOZ: { name: 'Solidarität', desc: 'zusätzliche Einheiten pro Bataillon', apply: (s, b, n) => (s.units += n >= 4 ? 2 : 1), text: (b, n) => `+${n >= 4 ? 2 : 1} Einheit${n >= 4 ? 'en' : ''} pro Bataillon` },
  LIB: { name: 'Freier Markt', desc: 'mehr Tempo und etwas Angriff', apply: (s, b) => { s.spd += b * 1.2; s.atk += b * 0.4; }, text: (b) => `+${Math.round(b * 120)} % Tempo, +${Math.round(b * 40)} % Angriff` },
  GRU: { name: 'Nachhaltigkeit', desc: 'Truppen regenerieren Lebenspunkte', apply: (s, b) => (s.regen += b * 0.15), text: (b) => `Regeneration ${(b * 15).toFixed(1)} % LP pro Sekunde` },
  UNA: { name: 'Widerstand', desc: 'mehr Angriff', apply: (s, b) => (s.atk += b * 1.1), text: (b) => `+${Math.round(b * 110)} % Angriff` },
  KRO: { name: 'Hofstaat', desc: 'deutlich stärkere Anführer', apply: (s, b) => { s.leader += b * 3; s.cd -= b * 0.5; }, text: (b) => `Anführer +${Math.round(b * 300)} % stärker, ${Math.round(b * 50)} % schnellere Fähigkeiten` },
  SON: { name: 'Diplomatie', desc: 'schnellere Fähigkeiten', apply: (s, b) => (s.cd -= b * 1.3), text: (b) => `${Math.round(b * 130)} % schnellere Fähigkeiten` },
};
const PARTY_BY_ID = {};
for (const [k, ids] of Object.entries(PARTY_GROUPS)) ids.split(' ').forEach((id) => (PARTY_BY_ID[id] = k));

function _hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

const POLITICIANS = RAW.map(([id, name, wiki, flag, region, era, cls, rarity, office]) => {
  const base = RARITIES[rarity].base;
  const tilt = CLASSES[cls].tilt;
  const h = _hash(id);
  const n = (shift) => ((h >>> shift) & 15) - 7; // -7..+8
  const clamp = (v) => Math.max(15, Math.min(99, v));
  return {
    id, name, wiki, flag, region, era, cls, rarity, office, party: PARTY_BY_ID[id] || 'SON',
    atk: clamp(base + tilt.a + n(0)),
    def: clamp(base + tilt.v + n(4)),
    tac: clamp(base + tilt.t + n(8)),
  };
});
const POL_BY_ID = Object.fromEntries(POLITICIANS.map((p) => [p.id, p]));

/* Level-Schwellen: benötigte Kopien gesamt für Level 1..5 */
const LEVEL_COPIES = [1, 2, 4, 7, 11];
const MAX_LEVEL = 5;
const LEVEL_BONUS = 0.08; // +8 % Werte pro Level

/* Synergien – Allianzen mit gemeinsamen Merkmalen werden stärker */
const SYNERGY_TIERS = { 2: 0.06, 3: 0.12, 4: 0.2, 5: 0.3 };
function computeSynergies(ids) {
  const pols = ids.map((id) => POL_BY_ID[id]).filter(Boolean);
  const per = {};
  pols.forEach((p) => (per[p.id] = { hp: 1, atk: 1, spd: 1, cd: 1, units: 0, regen: 0, leader: 1 }));
  const list = [];
  const group = (keyFn) => {
    const m = {};
    pols.forEach((p) => { const k = keyFn(p); (m[k] = m[k] || []).push(p); });
    return m;
  };
  // Region -> Rückhalt (HP)
  for (const [k, ps] of Object.entries(group((p) => p.region))) {
    const b = SYNERGY_TIERS[Math.min(ps.length, 5)];
    if (b) {
      ps.forEach((p) => (per[p.id].hp += b));
      list.push({ icon: REGIONS[k].icon, name: `Bündnis ${REGIONS[k].name}`, count: ps.length, text: `+${Math.round(b * 100)} % Rückhalt (HP)`, ids: ps.map((p) => p.id) });
    }
  }
  // Ära -> Angriff
  for (const [k, ps] of Object.entries(group((p) => p.era))) {
    const b = SYNERGY_TIERS[Math.min(ps.length, 5)];
    if (b) {
      ps.forEach((p) => (per[p.id].atk += b));
      list.push({ icon: '⏳', name: `Zeitgenossen: ${ERAS[k].short}`, count: ps.length, text: `+${Math.round(b * 100)} % Angriff`, ids: ps.map((p) => p.id) });
    }
  }
  // Partei -> eigener Fraktionsbonus je Parteienfamilie
  for (const [k, ps] of Object.entries(group((p) => p.party))) {
    const n = Math.min(ps.length, 5);
    const b = SYNERGY_TIERS[n];
    if (!b) continue;
    const PB = PARTY_BONUS[k];
    ps.forEach((p) => PB.apply(per[p.id], b, n));
    if (n >= 5) ps.forEach((p) => { per[p.id].atk += 0.05; per[p.id].hp += 0.05; });
    list.push({ icon: PARTIES[k].icon, name: `${PARTIES[k].short}: ${PB.name}`, count: ps.length, text: PB.text(b, n) + (n >= 5 ? ' · Absolute Mehrheit: +5 % Angriff & Rückhalt' : ''), ids: ps.map((p) => p.id), party: k });
  }
  // Klassenvielfalt -> Tempo & Fähigkeiten
  const classes = new Set(pols.map((p) => p.cls));
  if (classes.size >= 4) {
    const b = classes.size >= 5 ? 0.15 : 0.08;
    pols.forEach((p) => { per[p.id].spd += b; per[p.id].cd -= b; });
    list.push({ icon: '🎖️', name: 'Gemischte Streitkräfte', count: classes.size, text: `+${Math.round(b * 100)} % Tempo, schnellere Fähigkeiten`, ids: pols.map((p) => p.id) });
  }
  // Gleiche Klasse 3+ -> Spezialisierung
  for (const [k, ps] of Object.entries(group((p) => p.cls))) {
    if (ps.length >= 3) {
      const b = ps.length >= 4 ? 0.18 : 0.1;
      ps.forEach((p) => (per[p.id].atk += b / 2, per[p.id].hp += b / 2));
      list.push({ icon: CLASSES[k].icon, name: `Doktrin: ${CLASSES[k].name}`, count: ps.length, text: `+${Math.round(b * 50)} % Angriff & Rückhalt`, ids: ps.map((p) => p.id) });
    }
  }
  return { per, list };
}

function cardPower(p, level = 1) {
  return Math.round((p.atk + p.def + p.tac) * (1 + LEVEL_BONUS * (level - 1)));
}
