import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { resolveInput, resolveLinkURL, resolvePrefixURL } from '../js/search.js';

const resolve = (input, options) => resolveInput(input, 'google', options);
const searchOf = (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`;

describe('resolveInput', () => {
  test('dotted code stays a search', () => {
    for (const input of [
      'console.log',
      'next.js',
      'node.js',
      'os.path.join',
      'np.linalg.eig',
      'Object.entries',
      'README.md',
      'main.py',
      'install.sh',
      'lib.rs',
    ]) {
      assert.deepEqual(
        resolve(input),
        { kind: 'search', url: searchOf(input), label: 'Google', query: input },
        input,
      );
    }
  });

  test('real domains open over https', () => {
    assert.equal(resolve('github.com').url, 'https://github.com/');
    assert.equal(resolve('socket.io').url, 'https://socket.io/');
    assert.equal(resolve('github.com/user/repo?tab=1').url, 'https://github.com/user/repo?tab=1');
    assert.equal(resolve('my-app.vercel.app').url, 'https://my-app.vercel.app/');
    assert.equal(resolve('repubblica.it').url, 'https://repubblica.it/');
  });

  test('local development hosts open over http', () => {
    assert.equal(resolve('localhost').url, 'http://localhost/');
    assert.equal(resolve('localhost:5173').url, 'http://localhost:5173/');
    assert.equal(resolve('127.0.0.1:8000/api').url, 'http://127.0.0.1:8000/api');
    assert.equal(resolve('192.168.1.10:8080').url, 'http://192.168.1.10:8080/');
    assert.equal(resolve('0.0.0.0:8000').url, 'http://0.0.0.0:8000/');
    assert.equal(resolve('[::1]:3000').url, 'http://[::1]:3000/');
    assert.equal(resolve('myapp.test').url, 'http://myapp.test/');
    assert.equal(resolve('api.localhost:4000').url, 'http://api.localhost:4000/');
    assert.equal(resolve('build.corp:9000').url, 'http://build.corp:9000/');
  });

  test('invalid IPs and words with spaces are searched', () => {
    assert.equal(resolve('999.1.1.1').kind, 'search');
    assert.equal(resolve('useEffect cleanup').kind, 'search');
    assert.equal(resolve('github.com is down').kind, 'search');
    assert.equal(resolve('std::vector').kind, 'search');
  });

  test('explicit schemes are respected', () => {
    assert.equal(resolve('http://example.com').url, 'http://example.com/');
    assert.equal(resolve('HTTPS://Example.com/A').url, 'https://example.com/A');
    assert.equal(resolve('https://').kind, 'search');
  });

  test('chrome:// pages are opened through the browser', () => {
    assert.deepEqual(resolve('chrome://extensions'), { kind: 'browser', url: 'chrome://extensions' });
  });

  test('prefixes pick the search target', () => {
    assert.deepEqual(resolve('npm zod'), {
      kind: 'search',
      url: 'https://www.npmjs.com/search?q=zod',
      label: 'npm',
      query: 'zod',
    });
    assert.equal(resolve('!gh react hooks').url, 'https://github.com/search?q=react%20hooks');
    assert.equal(resolve('MDN flexbox').label, 'MDN');
    assert.equal(resolve('xyz flexbox').label, 'Google');
  });

  test('a prefix alone opens the site', () => {
    assert.deepEqual(resolve('yt'), { kind: 'url', url: 'https://www.youtube.com/', label: 'YouTube' });
    assert.equal(resolve('!gh').url, 'https://github.com/');
    assert.equal(resolve('  NPM  ').url, 'https://www.npmjs.com/');
    assert.equal(resolve('dd').url, 'https://devdocs.io/');
    assert.equal(resolve('yt', { force: true }).kind, 'search');
    assert.equal(resolve('xyz').kind, 'search');
  });

  test('names from Object.prototype are not prefixes', () => {
    for (const text of ['constructor', 'constructor x', 'toString', 'hasOwnProperty a']) {
      assert.equal(resolve(text).url, searchOf(text), text);
    }
  });

  test('personal prefixes put the query in place of %s', () => {
    const prefixes = {
      jira: { label: 'Jira', url: 'https://acme.atlassian.net/browse/%s' },
      pr: { label: 'PRs', url: 'https://github.com/me/app/pull/%s/files' },
    };
    assert.deepEqual(resolve('jira ABC-12', { prefixes }), {
      kind: 'search',
      url: 'https://acme.atlassian.net/browse/ABC-12',
      label: 'Jira',
      query: 'ABC-12',
    });
    assert.equal(resolve('!pr 42', { prefixes }).url, 'https://github.com/me/app/pull/42/files');
    assert.equal(resolve('jira a b&c', { prefixes }).url, 'https://acme.atlassian.net/browse/a%20b%26c');
    assert.deepEqual(resolve('JIRA', { prefixes }), {
      kind: 'url',
      url: 'https://acme.atlassian.net/',
      label: 'Jira',
    });
    assert.equal(resolve('jira x', { prefixes, force: true }).url, searchOf('jira x'));
    assert.equal(resolve('npm zod', { prefixes }).label, 'npm');
  });

  test('force always searches the default engine', () => {
    assert.equal(resolve('github.com', { force: true }).url, searchOf('github.com'));
    assert.equal(resolve('npm zod', { force: true }).url, searchOf('npm zod'));
  });

  test('engine choice and empty input', () => {
    assert.equal(resolveInput('rust', 'ddg').url, 'https://duckduckgo.com/?q=rust');
    assert.equal(resolveInput('rust', 'unknown').label, 'Google');
    assert.equal(resolve('   '), null);
  });
});

describe('resolvePrefixURL', () => {
  test('completes the scheme and keeps %s', () => {
    assert.equal(resolvePrefixURL('acme.atlassian.net/browse/%s'), 'https://acme.atlassian.net/browse/%s');
    assert.equal(resolvePrefixURL('localhost:3000/search?q=%s'), 'http://localhost:3000/search?q=%s');
    assert.equal(resolvePrefixURL(' https://x.dev/?a=%s&b=%s '), 'https://x.dev/?a=%s&b=%s');
  });

  test('needs %s outside the host and an http(s) address', () => {
    assert.equal(resolvePrefixURL('https://example.com/search'), null);
    assert.equal(resolvePrefixURL('https://%s.example.com/'), null);
    assert.equal(resolvePrefixURL('ftp://example.com/%s'), null);
    assert.equal(resolvePrefixURL('not a url %s'), null);
  });
});

describe('resolveLinkURL', () => {
  test('adds the scheme when missing', () => {
    assert.equal(resolveLinkURL('vercel.com/dashboard'), 'https://vercel.com/dashboard');
    assert.equal(resolveLinkURL('localhost:3000'), 'http://localhost:3000/');
    assert.equal(resolveLinkURL('https://a.dev'), 'https://a.dev/');
  });

  test('rejects anything that is not http(s)', () => {
    assert.equal(resolveLinkURL('javascript:alert(1)'), null);
    assert.equal(resolveLinkURL('not a url'), null);
    assert.equal(resolveLinkURL(''), null);
  });
});
