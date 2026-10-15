import { describe, expect, it } from 'vitest';
import { matchesTyped } from './typed-text';

const STARBUCKS = '\uC2A4\uD0C0\uBC85\uC2A4';

const STARBUCKS_INITIALS = '\u3145\u314C\u3142\u3145';

const BUCKS_INITIALS = '\u3142\u3145';

const SHINHAN_CARD = '\uC2E0\uD55C\uCE74\uB4DC';

const SHINHAN_CARD_INITIALS = '\u3145\u314E\u314B\u3137';

const STAR_BUCKS_SPACED = '\uC2A4\uD0C0 \uBC85\uC2A4';

const STAR_BUCKS_SPACED_INITIALS = '\u3145\u314C \u3142\u3145';

const STAR_INITIALS = '\u3145\u314C';

const STAR_BETWEEN_LATIN = 'A \uC2A4\uD0C0 B';

const STAR_DIGIT_BUCKS = '\uC2A4\uD0C01\uBC85\uC2A4';

const ATM_STAR = 'ATM \uC2A4\uD0C0';

const GAGE = '\uAC00\uAC8C';

const KKAPE = '\uAE4C\uD398';

const GIYEOK = '\u3131';

const SSANGGIYEOK = '\u3132';

const SAMSUNG = '\uC0BC\uC131';

const IEUNG = '\u3147';

const BUCKS_STAR_INITIALS = '\u3142\u3145\u3145';

const SAMSEO = '\uC0BC\uC11C';

const SA = '\uC0AC';

const SAMSEON = '\uC0BC\uC120';

const SEU_TIEUT = '\uC2A4\u314C';

const SEUTA_BIEUP = '\uC2A4\uD0C0\u3142';

const SEU_BIEUP = '\uC2A4\u3142';

const UIJA = '\uC758\uC790';

const EU = '\uC73C';

const GAPS = '\uAC12';

const GAP = '\uAC11';

const ANI = '\uC544\uB2C8';

const AN = '\uC548';

const GAK = '\uAC01';

const TABEOK = '\uD0C0\uBC85';

const BEOKTA = '\uBC85\uD0C0';

const ATM_WITHDRAWAL = 'ATM \uCD9C\uAE08';

const M_CHUL = 'm \uCD9C';

const ATM_WITHDRAWAL_UNSPACED = 'ATM\uCD9C\uAE08';

const SUTABA = '\u30B9\u30BF\u30D0';

const SUTABA_IN_HIRAGANA = '\u3059\u305F\u3070';

const SUTABA_HALF_WIDTH = '\uFF7D\uFF80\uFF8A\uFF9E';

const SUSHI_IN_HIRAGANA = '\u3059\u3057';

const SUSHI_IN_KATAKANA = '\u30B9\u30B7';

const KA_HIRAGANA = '\u304B';

const GA_HIRAGANA = '\u304C';

const GA_KATAKANA = '\u30AC';

const TSU_HIRAGANA = '\u3064';

const SMALL_TSU_KATAKANA = '\u30C3';

const KITTO_KATAKANA = '\u30AD\u30C3\u30C8';

const AA_KATAKANA = '\u30A2\u30FC';

const AA_HIRAGANA = '\u3042\u3042';

const ATM_FULL_WIDTH = '\uFF21\uFF34\uFF2D';

const ATM_FULL_WIDTH_LOWER = '\uFF41\uFF54\uFF4D';

const DIGITS_FULL_WIDTH = '\uFF11\uFF12';

const SUTABA_SEU = '\u30B9\u30BF\u30D0 \uC2A4\uD0C0';

describe('matchesTyped', () => {
  it('matches a name containing the typed text anywhere, ignoring case', () => {
    expect(matchesTyped('Starbucks', 'bucks')).toBe(true);
    expect(matchesTyped('Starbucks', 'AR')).toBe(true);
    expect(matchesTyped('starbucks', 'STAR')).toBe(true);
  });

  it('matches no name the typed text is not part of', () => {
    expect(matchesTyped('Salary', 'Bakery')).toBe(false);
    expect(matchesTyped('Rent', 'Rents')).toBe(false);
  });

  it('matches every name when nothing, or only spaces, is typed', () => {
    expect(matchesTyped('Salary', '')).toBe(true);
    expect(matchesTyped('Salary', '   ')).toBe(true);
  });

  it('ignores spaces around the typed text, and keeps those within it', () => {
    expect(matchesTyped('Blue Bottle', '  blue ')).toBe(true);
    expect(matchesTyped('Blue Bottle', 'e B')).toBe(true);
    expect(matchesTyped('BlueBottle', 'e B')).toBe(false);
  });
});

describe('matchesTyped in Korean', () => {
  it('matches a name whose initials hold the typed initials anywhere', () => {
    expect(matchesTyped(STARBUCKS, STARBUCKS_INITIALS)).toBe(true);
    expect(matchesTyped(STARBUCKS, BUCKS_INITIALS)).toBe(true);
    expect(matchesTyped(SHINHAN_CARD, SHINHAN_CARD_INITIALS)).toBe(true);
  });

  it('keeps a space typed between initials, lined up with the spaces in the name', () => {
    expect(matchesTyped(STAR_BUCKS_SPACED, STAR_BUCKS_SPACED_INITIALS)).toBe(true);
    expect(matchesTyped(STARBUCKS, STAR_BUCKS_SPACED_INITIALS)).toBe(false);
    expect(matchesTyped(STAR_BETWEEN_LATIN, STAR_INITIALS)).toBe(true);
  });

  it('keeps the characters that are not Hangul syllables in place among the initials', () => {
    expect(matchesTyped(STAR_DIGIT_BUCKS, STARBUCKS_INITIALS)).toBe(false);
    expect(matchesTyped(ATM_STAR, STAR_INITIALS)).toBe(true);
  });

  it('ignores spaces around typed initials', () => {
    expect(matchesTyped(STARBUCKS, `  ${STAR_INITIALS} `)).toBe(true);
  });

  it('keeps a double consonant distinct from its single one', () => {
    expect(matchesTyped(GAGE, GIYEOK)).toBe(true);
    expect(matchesTyped(KKAPE, GIYEOK)).toBe(false);
    expect(matchesTyped(KKAPE, SSANGGIYEOK)).toBe(true);
  });

  it('matches no name for initials that are in no name', () => {
    expect(matchesTyped(STARBUCKS, SHINHAN_CARD_INITIALS)).toBe(false);
    expect(matchesTyped(SAMSUNG, IEUNG)).toBe(false);
    expect(matchesTyped(STARBUCKS, BUCKS_STAR_INITIALS)).toBe(false);
  });

  it('keeps matching a name while a syllable is still being composed', () => {
    expect(matchesTyped(SAMSUNG, SAMSEO)).toBe(true);
    expect(matchesTyped(SAMSUNG, SA)).toBe(true);
    expect(matchesTyped(SAMSUNG, SAMSEON)).toBe(false);
  });

  it('matches finished syllables followed by an initial being composed', () => {
    expect(matchesTyped(STARBUCKS, SEU_TIEUT)).toBe(true);
    expect(matchesTyped(STARBUCKS, SEUTA_BIEUP)).toBe(true);
    expect(matchesTyped(STARBUCKS, SEU_BIEUP)).toBe(false);
  });

  it('matches compound vowels and finals by their parts', () => {
    expect(matchesTyped(UIJA, EU)).toBe(true);
    expect(matchesTyped(GAPS, GAP)).toBe(true);
  });

  it('matches a typed final consonant to the initial of the syllable after it', () => {
    expect(matchesTyped(ANI, AN)).toBe(true);
    expect(matchesTyped(GAGE, GAK)).toBe(true);
  });

  it('matches finished syllables typed whole, in order', () => {
    expect(matchesTyped(STARBUCKS, TABEOK)).toBe(true);
    expect(matchesTyped(STARBUCKS, BEOKTA)).toBe(false);
  });

  it('matches Latin within a name that also holds Hangul, ignoring case and keeping spaces', () => {
    expect(matchesTyped(ATM_WITHDRAWAL, 'atm')).toBe(true);
    expect(matchesTyped(ATM_WITHDRAWAL, M_CHUL)).toBe(true);
    expect(matchesTyped(ATM_WITHDRAWAL_UNSPACED, M_CHUL)).toBe(false);
  });
});

describe('matchesTyped in Japanese and across width', () => {
  it('matches hiragana typed against a name in katakana, and katakana against hiragana', () => {
    expect(matchesTyped(SUTABA, SUTABA_IN_HIRAGANA)).toBe(true);
    expect(matchesTyped(SUSHI_IN_HIRAGANA, SUSHI_IN_KATAKANA)).toBe(true);
    expect(matchesTyped(SUTABA, SUSHI_IN_HIRAGANA)).toBe(false);
  });

  it('matches half-width katakana to full-width katakana and to hiragana', () => {
    expect(matchesTyped(SUTABA, SUTABA_HALF_WIDTH)).toBe(true);
    expect(matchesTyped(SUTABA_HALF_WIDTH, SUTABA_IN_HIRAGANA)).toBe(true);
  });

  it('matches full-width Latin letters and digits to their ordinary forms, ignoring case', () => {
    expect(matchesTyped('ATM', ATM_FULL_WIDTH)).toBe(true);
    expect(matchesTyped('atm', ATM_FULL_WIDTH)).toBe(true);
    expect(matchesTyped(ATM_FULL_WIDTH, 'atm')).toBe(true);
    expect(matchesTyped('ATM', ATM_FULL_WIDTH_LOWER)).toBe(true);
    expect(matchesTyped('Rent 12', DIGITS_FULL_WIDTH)).toBe(true);
  });

  it('keeps a voiced kana distinct from its unvoiced one', () => {
    expect(matchesTyped(GA_HIRAGANA, KA_HIRAGANA)).toBe(false);
    expect(matchesTyped(GA_KATAKANA, KA_HIRAGANA)).toBe(false);
    expect(matchesTyped(GA_KATAKANA, GA_HIRAGANA)).toBe(true);
  });

  it('keeps small kana and the long-vowel mark as they are', () => {
    expect(matchesTyped(KITTO_KATAKANA, TSU_HIRAGANA)).toBe(false);
    expect(matchesTyped(KITTO_KATAKANA, SMALL_TSU_KATAKANA)).toBe(true);
    expect(matchesTyped(AA_KATAKANA, AA_HIRAGANA)).toBe(false);
  });

  it('keeps matching Korean initials and syllables after folding width and kana', () => {
    expect(matchesTyped(STARBUCKS, STARBUCKS_INITIALS)).toBe(true);
    expect(matchesTyped(STARBUCKS, SEU_TIEUT)).toBe(true);
    expect(matchesTyped(SAMSUNG, SAMSEO)).toBe(true);
    expect(matchesTyped(SUTABA_SEU, STAR_INITIALS)).toBe(true);
    expect(matchesTyped(SUTABA_SEU, SUTABA_IN_HIRAGANA)).toBe(true);
  });
});
