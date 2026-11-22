// All 78 cards of the Rider-Waite-Smith deck (Pamela Colman Smith, 1909 — public domain).
// Images are hotlinked from Wikimedia Commons; `file` is the Commons filename and `hash`
// is the first-char/first-two-chars of md5(file), which is how upload.wikimedia.org lays out paths.
// If a filename ever changes on Commons, update it here.

const RAW_CARDS = [
  // Major Arcana
  { name: "The Fool", arcana: "major", number: 0, file: "RWS_Tarot_00_Fool.jpg", hash: "9/90" },
  { name: "The Magician", arcana: "major", number: 1, file: "RWS_Tarot_01_Magician.jpg", hash: "d/de" },
  { name: "The High Priestess", arcana: "major", number: 2, file: "RWS_Tarot_02_High_Priestess.jpg", hash: "8/88" },
  { name: "The Empress", arcana: "major", number: 3, file: "RWS_Tarot_03_Empress.jpg", hash: "d/d2" },
  { name: "The Emperor", arcana: "major", number: 4, file: "RWS_Tarot_04_Emperor.jpg", hash: "c/c3" },
  { name: "The Hierophant", arcana: "major", number: 5, file: "RWS_Tarot_05_Hierophant.jpg", hash: "8/8d" },
  { name: "The Lovers", arcana: "major", number: 6, file: "RWS_Tarot_06_Lovers.jpg", hash: "d/db" },
  { name: "The Chariot", arcana: "major", number: 7, file: "RWS_Tarot_07_Chariot.jpg", hash: "9/9b" },
  { name: "Strength", arcana: "major", number: 8, file: "RWS_Tarot_08_Strength.jpg", hash: "f/f5" },
  { name: "The Hermit", arcana: "major", number: 9, file: "RWS_Tarot_09_Hermit.jpg", hash: "4/4d" },
  { name: "Wheel of Fortune", arcana: "major", number: 10, file: "RWS_Tarot_10_Wheel_of_Fortune.jpg", hash: "3/3c" },
  { name: "Justice", arcana: "major", number: 11, file: "RWS_Tarot_11_Justice.jpg", hash: "e/e0" },
  { name: "The Hanged Man", arcana: "major", number: 12, file: "RWS_Tarot_12_Hanged_Man.jpg", hash: "2/2b" },
  { name: "Death", arcana: "major", number: 13, file: "RWS_Tarot_13_Death.jpg", hash: "d/d7" },
  { name: "Temperance", arcana: "major", number: 14, file: "RWS_Tarot_14_Temperance.jpg", hash: "f/f8" },
  { name: "The Devil", arcana: "major", number: 15, file: "RWS_Tarot_15_Devil.jpg", hash: "5/55" },
  { name: "The Tower", arcana: "major", number: 16, file: "RWS_Tarot_16_Tower.jpg", hash: "5/53" },
  { name: "The Star", arcana: "major", number: 17, file: "RWS_Tarot_17_Star.jpg", hash: "d/db" },
  { name: "The Moon", arcana: "major", number: 18, file: "RWS_Tarot_18_Moon.jpg", hash: "7/7f" },
  { name: "The Sun", arcana: "major", number: 19, file: "RWS_Tarot_19_Sun.jpg", hash: "1/17" },
  { name: "Judgement", arcana: "major", number: 20, file: "RWS_Tarot_20_Judgement.jpg", hash: "d/dd" },
  { name: "The World", arcana: "major", number: 21, file: "RWS_Tarot_21_World.jpg", hash: "f/ff" },
  // Wands
  { name: "Ace of Wands", arcana: "minor", suit: "wands", number: 1, file: "Wands01.jpg", hash: "1/11" },
  { name: "Two of Wands", arcana: "minor", suit: "wands", number: 2, file: "Wands02.jpg", hash: "0/0f" },
  { name: "Three of Wands", arcana: "minor", suit: "wands", number: 3, file: "Wands03.jpg", hash: "f/ff" },
  { name: "Four of Wands", arcana: "minor", suit: "wands", number: 4, file: "Wands04.jpg", hash: "a/a4" },
  { name: "Five of Wands", arcana: "minor", suit: "wands", number: 5, file: "Wands05.jpg", hash: "9/9d" },
  { name: "Six of Wands", arcana: "minor", suit: "wands", number: 6, file: "Wands06.jpg", hash: "3/3b" },
  { name: "Seven of Wands", arcana: "minor", suit: "wands", number: 7, file: "Wands07.jpg", hash: "e/e4" },
  { name: "Eight of Wands", arcana: "minor", suit: "wands", number: 8, file: "Wands08.jpg", hash: "6/6b" },
  { name: "Nine of Wands", arcana: "minor", suit: "wands", number: 9, file: "Wands09.jpg", hash: "e/e7" },
  { name: "Ten of Wands", arcana: "minor", suit: "wands", number: 10, file: "Wands10.jpg", hash: "0/0b" },
  { name: "Page of Wands", arcana: "minor", suit: "wands", number: 11, file: "Wands11.jpg", hash: "6/6a" },
  { name: "Knight of Wands", arcana: "minor", suit: "wands", number: 12, file: "Wands12.jpg", hash: "1/16" },
  { name: "Queen of Wands", arcana: "minor", suit: "wands", number: 13, file: "Wands13.jpg", hash: "0/0d" },
  { name: "King of Wands", arcana: "minor", suit: "wands", number: 14, file: "Wands14.jpg", hash: "c/ce" },
  // Cups
  { name: "Ace of Cups", arcana: "minor", suit: "cups", number: 1, file: "Cups01.jpg", hash: "3/36" },
  { name: "Two of Cups", arcana: "minor", suit: "cups", number: 2, file: "Cups02.jpg", hash: "f/f8" },
  { name: "Three of Cups", arcana: "minor", suit: "cups", number: 3, file: "Cups03.jpg", hash: "7/7a" },
  { name: "Four of Cups", arcana: "minor", suit: "cups", number: 4, file: "Cups04.jpg", hash: "3/35" },
  { name: "Five of Cups", arcana: "minor", suit: "cups", number: 5, file: "Cups05.jpg", hash: "d/d7" },
  { name: "Six of Cups", arcana: "minor", suit: "cups", number: 6, file: "Cups06.jpg", hash: "1/17" },
  { name: "Seven of Cups", arcana: "minor", suit: "cups", number: 7, file: "Cups07.jpg", hash: "a/ae" },
  { name: "Eight of Cups", arcana: "minor", suit: "cups", number: 8, file: "Cups08.jpg", hash: "6/60" },
  { name: "Nine of Cups", arcana: "minor", suit: "cups", number: 9, file: "Cups09.jpg", hash: "2/24" },
  { name: "Ten of Cups", arcana: "minor", suit: "cups", number: 10, file: "Cups10.jpg", hash: "8/84" },
  { name: "Page of Cups", arcana: "minor", suit: "cups", number: 11, file: "Cups11.jpg", hash: "a/ad" },
  { name: "Knight of Cups", arcana: "minor", suit: "cups", number: 12, file: "Cups12.jpg", hash: "f/fa" },
  { name: "Queen of Cups", arcana: "minor", suit: "cups", number: 13, file: "Cups13.jpg", hash: "6/62" },
  { name: "King of Cups", arcana: "minor", suit: "cups", number: 14, file: "Cups14.jpg", hash: "0/04" },
  // Swords
  { name: "Ace of Swords", arcana: "minor", suit: "swords", number: 1, file: "Swords01.jpg", hash: "1/1a" },
  { name: "Two of Swords", arcana: "minor", suit: "swords", number: 2, file: "Swords02.jpg", hash: "9/9e" },
  { name: "Three of Swords", arcana: "minor", suit: "swords", number: 3, file: "Swords03.jpg", hash: "0/02" },
  { name: "Four of Swords", arcana: "minor", suit: "swords", number: 4, file: "Swords04.jpg", hash: "b/bf" },
  { name: "Five of Swords", arcana: "minor", suit: "swords", number: 5, file: "Swords05.jpg", hash: "2/23" },
  { name: "Six of Swords", arcana: "minor", suit: "swords", number: 6, file: "Swords06.jpg", hash: "2/29" },
  { name: "Seven of Swords", arcana: "minor", suit: "swords", number: 7, file: "Swords07.jpg", hash: "3/34" },
  { name: "Eight of Swords", arcana: "minor", suit: "swords", number: 8, file: "Swords08.jpg", hash: "a/a7" },
  { name: "Nine of Swords", arcana: "minor", suit: "swords", number: 9, file: "Swords09.jpg", hash: "2/2f" },
  { name: "Ten of Swords", arcana: "minor", suit: "swords", number: 10, file: "Swords10.jpg", hash: "d/d4" },
  { name: "Page of Swords", arcana: "minor", suit: "swords", number: 11, file: "Swords11.jpg", hash: "4/4c" },
  { name: "Knight of Swords", arcana: "minor", suit: "swords", number: 12, file: "Swords12.jpg", hash: "b/b0" },
  { name: "Queen of Swords", arcana: "minor", suit: "swords", number: 13, file: "Swords13.jpg", hash: "d/d4" },
  { name: "King of Swords", arcana: "minor", suit: "swords", number: 14, file: "Swords14.jpg", hash: "3/33" },
  // Pentacles
  { name: "Ace of Pentacles", arcana: "minor", suit: "pentacles", number: 1, file: "Pents01.jpg", hash: "f/fd" },
  { name: "Two of Pentacles", arcana: "minor", suit: "pentacles", number: 2, file: "Pents02.jpg", hash: "9/9f" },
  { name: "Three of Pentacles", arcana: "minor", suit: "pentacles", number: 3, file: "Pents03.jpg", hash: "4/42" },
  { name: "Four of Pentacles", arcana: "minor", suit: "pentacles", number: 4, file: "Pents04.jpg", hash: "3/35" },
  { name: "Five of Pentacles", arcana: "minor", suit: "pentacles", number: 5, file: "Pents05.jpg", hash: "9/96" },
  { name: "Six of Pentacles", arcana: "minor", suit: "pentacles", number: 6, file: "Pents06.jpg", hash: "a/a6" },
  { name: "Seven of Pentacles", arcana: "minor", suit: "pentacles", number: 7, file: "Pents07.jpg", hash: "6/6a" },
  { name: "Eight of Pentacles", arcana: "minor", suit: "pentacles", number: 8, file: "Pents08.jpg", hash: "4/49" },
  { name: "Nine of Pentacles", arcana: "minor", suit: "pentacles", number: 9, file: "Pents09.jpg", hash: "f/f0" },
  { name: "Ten of Pentacles", arcana: "minor", suit: "pentacles", number: 10, file: "Pents10.jpg", hash: "4/42" },
  { name: "Page of Pentacles", arcana: "minor", suit: "pentacles", number: 11, file: "Pents11.jpg", hash: "e/ec" },
  { name: "Knight of Pentacles", arcana: "minor", suit: "pentacles", number: 12, file: "Pents12.jpg", hash: "d/d5" },
  { name: "Queen of Pentacles", arcana: "minor", suit: "pentacles", number: 13, file: "Pents13.jpg", hash: "8/88" },
  { name: "King of Pentacles", arcana: "minor", suit: "pentacles", number: 14, file: "Pents14.jpg", hash: "1/1c" },
];

const BASE = "https://upload.wikimedia.org/wikipedia/commons";

/** @param {{ file: string, hash: string }} card @param {number} width Standard Commons thumb width (250, 330, 500, 960, ...) */
export const imageUrl = (card, width) => `${BASE}/thumb/${card.hash}/${card.file}/${width}px-${card.file}`;

export const commonsPageUrl = (card) => `https://commons.wikimedia.org/wiki/File:${card.file}`;

export const CARDS = RAW_CARDS.map((c) => ({ ...c, id: c.file.replace(/\.jpg$/, "").toLowerCase() }));
