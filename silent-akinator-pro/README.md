# silent-akinator-pro

[![npm](https://img.shields.io/npm/v/silent-akinator-pro.svg)](https://www.npmjs.com/package/silent-akinator-pro)
[![downloads](https://img.shields.io/npm/dm/silent-akinator-pro.svg)](https://www.npmjs.com/package/silent-akinator-pro)
[![license](https://img.shields.io/npm/l/silent-akinator-pro.svg)](LICENSE)

> **The working Akinator API for Node.js — the only akinator wrapper that still works in 2025 / 2026** after Cloudflare blocked the legacy `api-en4.akinator.com/ws/*` endpoints. Fast, zero-config, Promise-based, fully typed. By **Silent Tech**.

The genie / twenty-questions / character-guessing SDK for **Discord bots, Telegram bots, WhatsApp bots, web games, and CLIs**.

## Why this package

Most akinator npm packages (`aki-api`, `akinator-api-node`, older `silent-akinator`, etc.) hit JSON endpoints that now return **HTTP 403 / Cloudflare Just-a-moment**. This package uses the **real HTML form flow** the actual website uses — `POST /game`, `/answer`, `/cancel_answer`, `/exclude`, `/list`, `/choice` — no TLS spoofing, no proxies, no `curl-impersonate`. Just clean `undici` + `cheerio`.

- Working in 2025 / 2026 (Cloudflare-safe)
- 22 regions including `en`, `en_objects`, `en_animals`, `fr`, `de`, `es`, `it`, `pt`, `ru`, `ar`, `jp`, `kr`, `cn`, `nl`, `pl`, `tr`, `il`, `id`
- Child mode supported
- Full game lifecycle: `start`, `answer`, `back`, `win`, `exclude`, `choice`
- TypeScript types included
- Tiny: only `undici` + `cheerio`
- MIT licensed

## Install

```bash
npm i silent-akinator-pro
```

## Usage

```js
const Akinator = require('silent-akinator-pro');

(async () => {
  const aki = new Akinator({ region: 'en', childMode: false });
  await aki.start();
  console.log(aki.question);                   // first question

  // 0=yes 1=no 2=idk 3=probably 4=probably-not
  // (or 'y' / 'n' / 'idk' / 'p' / 'pn')
  const r = await aki.answer('y');
  console.log(r.question, r.progression);

  while (!aki.guessed && aki.step < 80) {
    await aki.answer('idk');
  }

  if (aki.guessed) {
    console.log('Akinator thinks of:', aki.guess.name);
    await aki.choice();   // confirm
  }
})();
```

## API

| Method        | Description                                  |
|---------------|----------------------------------------------|
| `start()`     | Begin a new game; returns first question     |
| `answer(a)`   | Submit answer (`0..4` or `y/n/idk/p/pn`)     |
| `back()`      | Undo last answer                             |
| `win()`       | Force Akinator to guess now                  |
| `exclude()`   | Reject the guess and continue                |
| `choice()`    | Confirm the guess (close session)            |

### Properties
`region`, `childMode`, `question`, `step`, `progression`, `guess`, `guessed`, `finished`.

## Discord bot example

```js
const Akinator = require('silent-akinator-pro');
const games = new Map();

client.on('messageCreate', async (msg) => {
  if (msg.content === '!aki') {
    const aki = new Akinator({ region: 'en' });
    await aki.start();
    games.set(msg.author.id, aki);
    return msg.reply(aki.question);
  }
  if (['y','n','idk','p','pn'].includes(msg.content)) {
    const aki = games.get(msg.author.id);
    if (!aki) return;
    await aki.answer(msg.content);
    if (aki.guessed) return msg.reply(`Is it **${aki.guess.name}**? (${aki.guess.description})`);
    msg.reply(aki.question);
  }
});
```

## Keywords

akinator, akinator api, working akinator, akinator 2025, akinator 2026, akinator cloudflare bypass, akinator 403 fix, akinator discord bot, akinator telegram bot, akinator whatsapp bot, twenty questions, character guessing game, genie sdk, node akinator client, aki-api alternative, silent tech, silent-akinator, silent-akinator-pro.

## License

MIT (c) Silent Tech
