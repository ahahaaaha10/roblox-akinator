'use strict';

const { request } = require('undici');
const { load } = require('cheerio');

const REGIONS = [
  'en', 'en2', 'en_objects', 'en_animals', 'ar', 'cn', 'de',
  'es', 'fr', 'fr_objects', 'fr_animals', 'il', 'it', 'jp',
  'jp_animals', 'kr', 'nl', 'pl', 'pt', 'ru', 'tr', 'id'
];

const ANSWER_MAP = {
  y: 0, yes: 0, '0': 0,
  n: 1, no: 1, '1': 1,
  idk: 2, dk: 2, "don't know": 2, '2': 2,
  p: 3, probably: 3, '3': 3,
  pn: 4, 'probably not': 4, '4': 4
};

const BASE_HEADERS = {
  'content-type': 'application/x-www-form-urlencoded',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'x-requested-with': 'XMLHttpRequest'
};

const form = (obj) => new URLSearchParams(
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, String(v)])
  )
).toString();

class Akinator {
  constructor(opts = {}) {
    const { region = 'en', childMode = false } = opts;

    if (!REGIONS.includes(region)) {
      throw new Error(`Invalid region "${region}"`);
    }

    this.region = region;
    this.childMode = !!childMode;
    this.uri = `https://${region}.akinator.com`;
    this.headers = { ...BASE_HEADERS };
    this.cookies = new Map();

    this.session = null;
    this.signature = null;
    this.step = 0;
    this.progression = '0.00000';
    this.question = null;
    this.guessed = false;
    this.guess = null;
    this.finished = false;
  }

  _saveCookies(res) {
    const cookies = res.headers['set-cookie'] || [];

    for (const item of (Array.isArray(cookies) ? cookies : [cookies])) {
      const pair = String(item).split(';', 1)[0];
      const i = pair.indexOf('=');

      if (i > 0) {
        this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
      }
    }
  }

  async _request(url, options = {}) {
    const headers = {
      ...this.headers,
      ...(options.headers || {})
    };

    if (this.cookies.size) {
      headers.cookie = [...this.cookies.entries()]
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
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
      throw new Error('Invalid answer');
    }

    return code;
  }

  async start() {
    const home = await this._request(`${this.uri}/`, {
      method: 'GET',
      headers: {
        accept: 'text/html,application/xhtml+xml'
      }
    });

    await home.body.text();

    const res = await this._request(`${this.uri}/game`, {
      method: 'POST',
      headers: this.headers,
      body: form({
        cm: this.childMode,
        sid: 1
      }),
      maxRedirections: 5
    });

    if (res.statusCode !== 200) {
      throw new Error(`Akinator /game returned ${res.statusCode}`);
    }

    const html = await res.body.text();
    const $ = load(html);

    console.log('AKI PAGE TITLE:', $('title').text());

    console.log('AKI FORMS:', JSON.stringify(
      $('form').map((i, el) => ({
        id: $(el).attr('id'),
        action: $(el).attr('action')
      })).get()
    ));

    console.log('AKI INPUTS:', JSON.stringify(
      $('input').map((i, el) => ({
        id: $(el).attr('id'),
        name: $(el).attr('name'),
        type: $(el).attr('type')
      })).get()
    ));

    console.log(
      'HAS SIGNATURE TEXT:',
      html.toLowerCase().includes('signature')
    );

    this.session =
      $('#askSoundlike > #session').attr('value') ||
      $('#session').attr('value');

    this.signature =
      $('#askSoundlike > #signature').attr('value') ||
      $('#signature').attr('value');

    this.question =
      $('#question-label').text().trim() ||
      $('.bubble-body .question-text').text().trim();

    if (!this.session || !this.signature) {
      throw new Error(
        'Failed to parse session/signature from Akinator response.'
      );
    }

    this.step = 0;
    this.progression = '0.00000';

    return {
      question: this.question,
      step: this.step,
      progression: this.progression,
      answers: [
        'yes',
        'no',
        'idk',
        'probably',
        'probably not'
      ]
    };
  }
}

module.exports = Akinator;