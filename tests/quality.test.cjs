const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { boot } = require("./harness.cjs");
const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const key = source.match(/const (?:STORAGE_KEY|STORE|KEY) = "([^"]+)"/)[1];
const fixture = async (t, options) => {
  const h = await boot(options);
  t.after(h.close);
  return h;
};

test("fresh workspace starts without runtime errors", async (t) => {
  const h = await fixture(t);
  assert.deepEqual(h.errors, []);
  assert.ok(h.document.querySelector("main"));
  assert.ok(h.document.title.length > 5);
  assert.ok(h.document.querySelector('meta[name="description"]'));
});

for (const raw of ["{bad json", "{}", '{"__proto__":{"injected":true}}']) {
  test("invalid storage is recoverable: " + raw.slice(0, 18), async (t) => {
    const h = await fixture(t, { saved: { [key]: raw } });
    assert.deepEqual(h.errors, []);
    assert.match(h.$("#storage-notice").textContent, /could not be loaded/);
    assert.equal(h.window.localStorage.getItem(key + ".recovery"), raw);
    h.click("#storage-notice button");
    assert.equal(h.downloads.length, 1);
  });
}

test("denied browser storage keeps the app usable in session mode", async (t) => {
  const h = await fixture(t, { blocked: true });
  assert.deepEqual(h.errors, []);
  assert.equal(h.window.WorkspaceStorage.persistent, false);
  assert.match(h.$("#storage-notice").textContent, /Session-only/);
  assert.equal(h.window.WorkspaceStorage.setItem("test", '{"ok":true}'), false);
  assert.equal(h.window.WorkspaceStorage.getItem("test"), null); // wrong schema is not trusted
});

test("quota failure is visible and never throws", async (t) => {
  const h = await fixture(t);
  h.window.Storage.prototype.setItem = () => {
    throw new Error("Quota exceeded");
  };
  assert.equal(h.window.WorkspaceStorage.setItem(key, "{}"), false);
  assert.match(h.$("#storage-notice").textContent, /not saved to disk/);
});

test("WCAG automated semantics (layout and contrast require browser review)", async (t) => {
  const h = await fixture(t);
  h.window.eval(require("axe-core").source);
  const result = await h.window.axe.run(h.document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  assert.equal(
    result.violations.length,
    0,
    JSON.stringify(
      result.violations.map((v) => ({
        rule: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ),
  );
});
