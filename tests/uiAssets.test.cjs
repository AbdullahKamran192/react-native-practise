const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}

test('configured defaults preserve every original vector icon', () => {
  const config = load('assets/brand/uiAssets.ts', { './artwork': {} });
  for (const [name, key] of Object.entries(config.iconKeys)) {
    assert.deepEqual(config.uiIcons[key], { kind: 'icon', name });
  }
});

test('a central replacement renders an untinted image with the requested size and label', () => {
  const config = load('assets/brand/uiAssets.ts', { './artwork': {} });
  const { AppIcon } = load('src/components/brand/AppIcon.tsx', {
    '@expo/vector-icons': { Ionicons: { glyphMap: {} } },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { Image: 'Image', StyleSheet: { flatten: value => value } },
    '../../../assets/brand/uiAssets': config,
  });
  config.uiIcons.caloriesIcon = { kind: 'image', source: 123 };
  const result = AppIcon({ name: 'flame-outline', size: 20, color: 'red', accessibilityLabel: 'Calories' });
  assert.equal(result.type, 'Image');
  assert.equal(result.props.source, 123);
  assert.equal(result.props.style.width, 20);
  assert.equal(result.props.style.height, 20);
  assert.equal(result.props.style.tintColor, undefined);
  assert.equal(result.props.accessibilityLabel, 'Calories');
  config.uiIcons.caloriesIcon.tint = true;
  assert.equal(AppIcon({ name: 'flame-outline', color: 'red' }).props.style.tintColor, 'red');
});
