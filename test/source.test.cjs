const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, source } = require('./helpers.cjs');

test('all game scripts and the inline touch controls parse', () => {
  for (const file of fs.readdirSync(path.join(root, 'js')).filter(file => file.endsWith('.js')))
    assert.doesNotThrow(() => new vm.Script(source(`js/${file}`), {filename: file}));
  for (const [, attributes, script] of source('index.html').matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const external = attributes.match(/src="([^"]+)"/);
    if (external) assert.equal(fs.existsSync(path.join(root, external[1])), true, external[1]);
    else assert.doesNotThrow(() => new vm.Script(script, {filename: 'index.html'}));
  }
});
