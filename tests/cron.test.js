import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { describeCron, nextRuns, parseCron } from '../js/cron.js';
import { runTools } from '../js/devtools.js';
import { setLanguage } from '../js/i18n.js';

setLanguage('en');
afterEach(() => setLanguage('en'));

const describe5 = (text) => describeCron(parseCron(text));
// Local time, so the runs do not depend on the machine's time zone. 10 March 2026 is a Tuesday.
const NOW = new Date(2026, 2, 10, 12, 0).getTime();
const runs = (text, count) =>
  nextRuns(parseCron(text), NOW, count).map(
    (date) =>
      `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`,
  );

describe('parseCron', () => {
  test('fields, names, ranges, steps and lists', () => {
    const { fields } = parseCron('*/20 9-11 1,15 jan-mar mon-fri');
    assert.deepEqual(fields.minute.values, [0, 20, 40]);
    assert.deepEqual(fields.hour.values, [9, 10, 11]);
    assert.deepEqual(fields.day.values, [1, 15]);
    assert.deepEqual(fields.month.values, [1, 2, 3]);
    assert.deepEqual(fields.weekday.values, [1, 2, 3, 4, 5]);
    assert.deepEqual(parseCron('5/20 * * * 7').fields.minute.values, [5, 25, 45]);
    assert.deepEqual(parseCron('0 0 * * 7').fields.weekday.values, [0]); // 7 is Sunday too
  });

  test('macros', () => {
    assert.deepEqual(parseCron('@daily'), parseCron('0 0 * * *'));
    assert.deepEqual(parseCron('@HOURLY'), parseCron('0 * * * *'));
    assert.deepEqual(parseCron('@reboot'), { error: 'reboot' });
  });

  test('errors name the field', () => {
    assert.deepEqual(parseCron('* * * *'), { error: 'fields' });
    assert.deepEqual(parseCron('60 * * * *'), { error: 'minute' });
    assert.deepEqual(parseCron('* 5-1 * * *'), { error: 'hour' });
    assert.deepEqual(parseCron('* * 0 * *'), { error: 'day' });
    assert.deepEqual(parseCron('* * * foo *'), { error: 'month' });
    assert.deepEqual(parseCron('*/0 * * * *'), { error: 'minute' });
    assert.deepEqual(parseCron('mon * * * *'), { error: 'minute' });
    assert.deepEqual(parseCron('constructor'), { error: 'fields' });
  });
});

describe('describeCron', () => {
  test('in English', () => {
    assert.equal(describe5('*/15 9-18 * * 1-5'), 'Every 15 minutes, hours 9–18, on Monday–Friday');
    assert.equal(describe5('0 9 * * 1'), 'At 09:00, on Monday');
    assert.equal(describe5('30 2 1 * *'), 'At 02:30, on day 1 of the month');
    assert.equal(describe5('0 0 1 1 *'), 'At 00:00, on day 1 of the month, in January');
    assert.equal(describe5('@daily'), 'At 00:00, every day');
    assert.equal(describe5('0 9,12,18 * * *'), 'At 09:00, 12:00, 18:00, every day');
    assert.equal(describe5('15,45 * * * *'), 'At minutes 15, 45 past every hour');
    assert.equal(describe5('0 */2 * * *'), 'At minute 0, every 2 hours');
    assert.equal(describe5('0 0 13 * 5'), 'At 00:00, on day 13 of the month or on Friday');
    assert.equal(describe5('* * * * *'), 'Every minute');
    assert.equal(describe5('5 4 * * sun'), 'At 04:05, on Sunday');
    assert.equal(describe5('0 12 * jan-mar mon,fri'), 'At 12:00, on Monday, Friday, in January–March');
  });

  test('in Italian', () => {
    setLanguage('it');
    assert.equal(describe5('*/15 9-18 * * 1-5'), 'Ogni 15 minuti, ore 9–18, di lunedì–venerdì');
    assert.equal(describe5('0 0 1 1 *'), 'Alle 00:00, il giorno 1 del mese, in gennaio');
    assert.equal(describe5('15,45 * * * *'), 'Ai minuti 15, 45 di ogni ora');
  });
});

describe('nextRuns', () => {
  test('the next runs after now', () => {
    assert.deepEqual(runs('*/15 9-18 * * 1-5'), ['3/10 12:15', '3/10 12:30', '3/10 12:45']);
    assert.deepEqual(runs('0 9 * * 1'), ['3/16 9:00', '3/23 9:00', '3/30 9:00']);
    assert.deepEqual(runs('0 12 * * *', 2), ['3/11 12:00', '3/12 12:00']); // 12:00 today is not after now
  });

  test('both day fields: either one is enough', () => {
    assert.deepEqual(runs('0 0 13 * 5'), ['3/13 0:00', '3/20 0:00', '3/27 0:00']);
  });

  test('a date that never comes', () => {
    assert.deepEqual(runs('0 0 30 2 *'), []);
  });
});

describe('cron in the palette', () => {
  test('description first, then the next runs', () => {
    const results = runTools('cron */15 9-18 * * 1-5', NOW);
    assert.equal(results[0].value, 'Every 15 minutes, hours 9–18, on Monday–Friday');
    assert.deepEqual(
      results.slice(1).map((result) => result.detail),
      ['Next run, in 15 minutes', 'Next run, in 30 minutes', 'Next run, in 45 minutes'],
    );
  });

  test('a bare expression is recognized; arithmetic stays arithmetic', () => {
    assert.ok(runTools('*/5 * * * *', NOW).every((result) => result.tool === 'cron' && result.first));
    assert.equal(runTools('@weekly', NOW)[0].value, 'At 00:00, on Sunday');
    assert.equal(runTools('1 * 2 * 3', NOW)[0].value, '6');
  });

  test('errors and dates that never come', () => {
    assert.equal(
      runTools('cron * * *', NOW)[0].value,
      'Five fields needed: minute, hour, day of month, month, day of week',
    );
    assert.equal(runTools('cron 99 * * * *', NOW)[0].value, 'Invalid value in the “minute” field');
    const never = runTools('cron 0 0 30 2 *', NOW);
    assert.equal(never.at(-1).value, 'No run in the next 5 years');
    assert.equal(never.at(-1).error, true);
  });
});
