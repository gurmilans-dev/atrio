import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { decodeBase64, encodeBase64, evaluate, password, runTools } from '../js/devtools.js';

const NOW = Date.UTC(2026, 9, 26, 12, 0, 0);
const values = (text) => runTools(text, NOW).map((result) => result.value);
const tools = (text) => runTools(text, NOW).map((result) => result.tool);

describe('calculator', () => {
  test('precedence, powers and unary minus follow maths', () => {
    assert.equal(evaluate('2+3*4'), 14);
    assert.equal(evaluate('(1+2)^2'), 9);
    assert.equal(evaluate('2^3^2'), 512);
    assert.equal(evaluate('-2^2'), -4);
    assert.equal(evaluate('2**10'), 1024);
    assert.equal(evaluate('10 % 3'), 1);
    assert.equal(evaluate('6 × 7 ÷ 2'), 21);
  });

  test('functions, constants, hex and binary literals', () => {
    assert.equal(evaluate('sqrt(16) + abs(-2)'), 6);
    assert.equal(evaluate('max(1, 7, 3)'), 7);
    assert.equal(evaluate('0xff + 0b11'), 258);
    assert.equal(evaluate('1e3 / 4'), 250);
    assert.ok(Math.abs(evaluate('pi') - Math.PI) < 1e-12);
  });

  test('invalid or unsafe input gives null', () => {
    for (const input of [
      '2 +',
      '1/0',
      'alert(1)',
      'constructor',
      'constructor(1)',
      'toString + 1',
      '(1',
      '1 2',
      '',
      'sqrt 4',
    ]) {
      assert.equal(evaluate(input), null, input);
    }
  });

  test('"=" shows the result, plus hex and binary for integers', () => {
    assert.deepEqual(values('= 2^8 - 1'), ['255', '0xff', '0b11111111']);
    assert.deepEqual(values('= 1/3'), ['0.333333333333']);
    assert.equal(runTools('= 2 +', NOW)[0].error, true);
  });

  test('plain arithmetic is detected, dates and phone numbers are not', () => {
    assert.deepEqual(values('2+2'), ['4']);
    assert.equal(runTools('(5+3)/2', NOW)[0].first, true);
    assert.deepEqual(values('2026-10-26'), []);
    assert.deepEqual(values('+39 333 1234567'), []);
    assert.deepEqual(values('c++'), []);
  });
});

describe('timestamps', () => {
  test('"ts" gives the current time', () => {
    assert.deepEqual(values('ts'), [String(NOW / 1000), String(NOW), '2026-10-26T12:00:00.000Z']);
  });

  test('seconds and milliseconds are converted to dates', () => {
    const [local, iso, relative] = values('ts 1730000000');
    assert.equal(iso, new Date(1730000000 * 1000).toISOString());
    assert.match(local, /2024/);
    assert.match(relative, /fa$/);
    assert.equal(values('ts 1730000000000')[1], iso);
  });

  test('dates are converted to timestamps', () => {
    assert.deepEqual(values('ts 2026-10-26T12:00:00Z'), [
      String(NOW / 1000),
      String(NOW),
      '2026-10-26T12:00:00.000Z',
    ]);
    assert.equal(runTools('ts not a date', NOW)[0].error, true);
  });

  test('a bare timestamp is offered below the search', () => {
    const results = runTools('1730000000', NOW);
    assert.equal(results.length, 3);
    assert.ok(results.every((result) => !result.first));
  });
});

describe('encodings', () => {
  test('Base64 round trip with UTF-8', () => {
    assert.equal(encodeBase64('ciao è'), 'Y2lhbyDDqA==');
    assert.equal(decodeBase64('Y2lhbyDDqA=='), 'ciao è');
    assert.equal(decodeBase64('Y2lhbyDDqA'), 'ciao è'); // missing padding
    assert.equal(decodeBase64('%%%'), null);
    assert.deepEqual(values('b64 ciao è'), ['Y2lhbyDDqA==']);
    assert.deepEqual(values('b64d Y2lhbyDDqA=='), ['ciao è']);
    assert.equal(runTools('b64d %%%', NOW)[0].error, true);
  });

  test('URL encode and decode', () => {
    assert.deepEqual(values('url a b&c=d'), ['a%20b%26c%3Dd']);
    assert.deepEqual(values('urld a%20b+c'), ['a b c']);
    assert.equal(runTools('urld %E0%A4%A', NOW)[0].error, true);
  });

  test('keywords alone need an argument', () => {
    assert.deepEqual(values('b64'), []);
    assert.deepEqual(values('url'), []);
  });
});

describe('colors', () => {
  test('hex, rgb and hsl convert into each other', () => {
    const [hex, rgb, hsl] = values('#7aa2f7');
    assert.equal(hex, '#7aa2f7');
    assert.equal(rgb, 'rgb(122, 162, 247)');
    assert.match(hsl, /^hsl\(22\d, \d+%, \d+%\)$/);
    assert.equal(values('#abc')[0], '#aabbcc');
    assert.equal(values('rgb(255, 0, 0)')[0], '#ff0000');
    assert.equal(values('hsl(120, 100%, 50%)')[0], '#00ff00');
    assert.equal(runTools('#7aa2f7', NOW)[0].color, '#7aa2f7');
  });

  test('not colors', () => {
    assert.deepEqual(values('rgb(300, 0, 0)'), []);
    assert.deepEqual(values('#12'), []);
  });
});

describe('random values', () => {
  test('uuid', () => {
    const [one] = values('uuid');
    assert.match(one, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(new Set(values('uuid 5')).size, 5);
    assert.equal(values('uuid 50').length, 10);
  });

  test('passwords: length, alphabet, randomness', () => {
    const [full, plain] = values('pw');
    assert.equal(full.length, 20);
    assert.match(plain, /^[A-HJ-NP-Za-km-z2-9]{20}$/);
    assert.equal(values('pw 32')[0].length, 32);
    assert.equal(values('pw 3')[0].length, 8);
    assert.notEqual(password(24, 'abc'), password(24, 'abc'));
    assert.deepEqual(tools('pw'), ['pw', 'pw']);
  });
});

test('ordinary searches trigger no tool', () => {
  for (const input of ['react hooks', 'console.log', 'github.com', 'yt', 'next.js 15']) {
    assert.deepEqual(values(input), [], input);
  }
});
