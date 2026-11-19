const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'),
);

if (manifest.manifest_version !== 3) {
  throw new Error('manifest_version must be 3');
}

const referencedFiles = [
  manifest.action.default_popup,
  ...Object.values(manifest.icons),
  ...manifest.content_scripts.flatMap((entry) => [
    ...(entry.js || []),
    ...(entry.css || []),
  ]),
];

for (const relativePath of new Set(referencedFiles)) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Missing manifest resource: ${relativePath}`);
  }
}

const context = {
  console,
  URL,
  setTimeout,
  clearTimeout,
  globalThis: null,
  chrome: {
    storage: {
      local: {
        data: {},
        async get(keys) {
          const result = {};
          for (const key of keys) {
            if (Object.hasOwn(this.data, key)) {
              result[key] = this.data[key];
            }
          }
          return result;
        },
        async set(values) {
          Object.assign(this.data, values);
        },
      },
      onChanged: { addListener() {} },
    },
    runtime: { onMessage: { addListener() {} } },
  },
  window: {
    addEventListener() {},
    location: { origin: 'https://www.zhihu.com' },
    setTimeout,
    alert() {},
    postMessage() {},
  },
  document: {
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    documentElement: {},
  },
  Element: class Element {},
  DOMParser: class DOMParser {},
  MutationObserver: class MutationObserver {
    observe() {}
    disconnect() {}
  },
  fetch: async () => ({ ok: false, status: 500 }),
};

context.globalThis = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, 'scripts/content.js'), 'utf8'),
  context,
);

setTimeout(() => {
  console.log(
    `Smoke test passed: ${new Set(referencedFiles).size} manifest resources validated`,
  );
}, 20);
