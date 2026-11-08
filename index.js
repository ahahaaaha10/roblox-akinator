'use strict';
/*!
 * silent-akinator-pro
 * Working Akinator API client (2025/2026) — bypasses Cloudflare 403 by using
 * the real HTML form-POST flow instead of the deprecated /ws JSON endpoints.
 *
 * Answers: 0=yes  1=no  2=idk  3=probably  4=probably-not
 * (c) Silent Tech — MIT
 */
const { request } = require('undici');
const { load }    = require('cheerio');

const REGIONS = [
  'en','en2','en_objects','en_animals','ar','cn','de','es','fr','fr_objects',
  'fr_animals','il','it','jp','jp_animals','kr','nl','pl','pt','ru','tr','id',
];

const ANSWER_MAP = {
  y: 0, yes: 0, '0': 0,
  n: 1, no: 1, '1': 1,
  idk: 2, dk: 2, "don't know": 2, '2': 2,
  p: 3, probably: 3, '3': 3,
  pn: 4, 'probably not': 4, '4': 4,
};

const BASE_HEADERS = {
  'content-type'    : 'application/x-www-form-urlencoded',
  'user-agent'      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'x-requested-with': 'XMLHttpRequest',
};

const form = (obj) => new URLSearchParams(
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v)]))
).toString();

class Akinator {
  /**
   * @param {object}  opts
   * @param {string}  [opts.region='en']      one of REGIONS
   * @param {boolean} [opts.childMode=false]  safe-mode filter
   */
  constructor(opts = {}) {
    const { region = 'en', childMode = false } = opts;
    if (!REGIONS.includes(region)) {
      throw new Error(`Invalid region "${region}". Valid: ${REGIONS.join(', ')}`);
    }
    this.region    = region;
    this.childMode = !!childMode;
    this.uri       = `https://${region}.akinator.com`;
    this.headers   = { ...BASE_HEADERS };
    this.cookies = new Map();

    this.session     = null;
    this.signature   = null;
    this.step        = 0;
    this.progression = '0.00000';
    this.question    = null;
    this.guessed     = false;
    this.guess       = null;
    this.finished    = false;
  }


  _saveCookies(res) {
    const cookies = res.headers["set-cookie"] || [];
    for (const item of (Array.isArray(cookies) ? cookies : [cookies])) {
      const pair = String(item).split(";", 1)[0];
      const i = pair.indexOf("=");
      if (i > 0) this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
  }

  async _request(url, options = {}) {
    const headers = { ...this.headers, ...(options.headers || {}) };
    if (this.cookies.size) {
      headers.cookie = [...this.cookies.entries()]
        .map(([k, v]) => `${k}=${v}`).join("; ");
    }
    const res = await request(url, {
      ...options,
      headers,
      maxRedirections: 5
    });
    this._saveCookies(res);
    return res;
  }

  _answerCode(a) {
    if (typeof a === 'number') a = String(a);
    const code = ANSWER_MAP[String(a).toLowerCase().trim()];
    if (code === undefined) {
      throw new Error(`Invalid answer "${a}". Use y / n / idk / p / pn or 0..4.`);
    }
    return code;
  }

  /** Start a new game. Resolves with the first question. */
  async start() {
    const home = await this._request(`${this.uri}/`, {
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml"
      }
    });
    await home.body.text();

    const res = await this._request(`${this.uri}/game`, {
      method: 'POST',
      headers: this.headers,
      body: form({ cm: this.childMode, sid: 1 }),
      maxRedirections: 5,
    });
    if (res.statusCode !== 200) {
      throw new Error(`Akinator /game returned ${res.statusCode}`);
    }
    const html = await res.body.text();
    const $    = load(html);

    this.session   = $('#askSoundlike > #session').attr('value')
                  || $('#session').attr('value');
    this.signature = $('#askSoundlike > #signature').attr('value')
                  || $('#signature').attr('value');
    this.question  = $('#question-label').text().trim()
                  || $('.bubble-body .question-text').text().trim();

    if (!this.session || !this.signature) {
      throw new Error('Failed to parse session/signature from Akinator response.');
    }
    this.step        = 0;
    this.progression = '0.00000';
    return {
      question: this.question,
      step: this.step,
      progression: this.progression,
      answers: ['yes', 'no', 'idk', 'probably', 'probably not'],
    };
  }

  /**
   * Submit an answer.
   * @param {0|1|2|3|4|string} a
   */
  async answer(a) {
    if (this.finished) throw new Error('Game already finished.');
    if (!this.session) throw new Error('Call start() first.');
    const ans = this._answerCode(a);

    const res = await this._request(`${this.uri}/answer`, {
      method: 'POST',
      headers: this.headers,
      body: form({
        step                : this.step,
        progression         : this.progression,
        sid                 : 1,
        cm                  : this.childMode,
        answer              : ans,
        step_last_proposition: '',
        session             : this.session,
        signature           : this.signature,
      }),
    });

    let data;
    try { data = JSON.parse(await res.body.text()); }
    catch { throw new Error(`/answer returned non-JSON (status ${res.statusCode}).`); }

    if (data.id_proposition || data.name_proposition) {
      this.guess = {
        id          : data.id_proposition,
        name        : data.name_proposition,
        description : data.description_proposition,
        photo       : data.photo,
        pseudo      : data.pseudo,
        flag_photo  : data.flag_photo,
      };
      this.guessed = true;
      return { guess: this.guess, step: Number(this.step), progression: this.progression };
    }

    this.step        = parseInt(data.step ?? this.step + 1, 10);
    this.progression = data.progression || this.progression;
    this.question    = data.question    || this.question;
    this.guessed     = false;
    this.guess       = null;
    return {
      question     : this.question,
      step         : this.step,
      progression  : this.progression,
      question_id  : data.question_id,
      completion   : data.completion,
    };
  }

  /** Undo the last answer. */
  async back() {
    if (this.step <= 0) throw new Error('Nothing to undo.');
    const res = await this._request(`${this.uri}/cancel_answer`, {
      method: 'POST',
      headers: this.headers,
      body: form({
        step       : this.step,
        progression: this.progression,
        sid        : 1,
        cm         : this.childMode,
        session    : this.session,
        signature  : this.signature,
      }),
    });
    const data = JSON.parse(await res.body.text());
    this.step        = parseInt(data.step ?? Math.max(0, this.step - 1), 10);
    this.progression = data.progression || this.progression;
    this.question    = data.question    || this.question;
    this.guessed     = false;
    this.guess       = null;
    return { question: this.question, step: this.step, progression: this.progression };
  }

  /** Force Akinator to make its best guess now. */
async win() {
  const res = await this._request(`${this.uri}/list`, {
  method: 'POST',
  headers: this.headers,
  body: form({
  step          : this.step,
  progression   : this.progression,
  sid           : 1,
  cm            : this.childMode,
  mode_question : 0,
  session       : this.session,
  signature     : this.signature,
  }),
  });
  const text = await res.body.text();
  let data;
  try { data = JSON.parse(text); }
  catch {
    // /list sometimes returns HTML when progression is too low or session expired.
    // Fall back to current guess or last known state.
    if (this.guess) return this.guess;
    throw new Error(`/list returned non-JSON (status ${res.statusCode}). Try answering more questions before calling win().`);
  }
  this.guessed = true;
  this.guess   = data;
  return data;
  }

  /** Reject the current guess and continue playing. */
  async exclude() {
    if (!this.guessed) throw new Error('No active guess to reject.');
    const res = await this._request(`${this.uri}/exclude`, {
      method: 'POST',
      headers: this.headers,
      body: form({
        step       : this.step,
        progression: this.progression,
        sid        : 1,
        cm         : this.childMode,
        session    : this.session,
        signature  : this.signature,
      }),
    });
    const data = JSON.parse(await res.body.text());
    this.step        = parseInt(data.step ?? this.step + 1, 10);
    this.progression = data.progression || this.progression;
    this.question    = data.question    || this.question;
    this.guessed     = false;
    this.guess       = null;
    return { question: this.question, step: this.step, progression: this.progression };
  }

  /** Confirm Akinator's guess (closes the session). */
  async choice() {
    if (!this.guess) throw new Error('No guess to confirm.');
    await this._request(`${this.uri}/choice`, {
      method: 'POST',
      headers: this.headers,
      body: form({
        sid         : 1,
        charac_name : this.guess.name        || '',
        charac_desc : this.guess.description || '',
        session     : this.session,
        signature   : this.signature,
        pflag_photo : 0,
      }),
    });
    this.finished = true;
    return this.guess;
  }
}

module.exports          = Akinator;
module.exports.default  = Akinator;
module.exports.Akinator = Akinator;
module.exports.REGIONS  = REGIONS;
