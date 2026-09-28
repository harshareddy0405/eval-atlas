const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { boot } = require("./harness.cjs");
const key = fs
  .readFileSync(path.join(__dirname, "../app.js"), "utf8")
  .match(/const (?:STORAGE_KEY|STORE|KEY) = "([^"]+)"/)[1];
const fixture = async (t, options) => {
  const h = await boot(options);
  t.after(() => {
    const errors = [...h.errors];
    h.close();
    assert.deepEqual(errors, []);
  });
  return h;
};
const submit = (h, selector) =>
  h
    .$(selector)
    .dispatchEvent(
      new h.window.Event("submit", { bubbles: true, cancelable: true }),
    );
const readBlob = (h, blob) =>
  new Promise((resolve, reject) => {
    const r = new h.window.FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsText(blob);
  });
async function roundTrip(t, h) {
  await h.wait(450);
  const raw = h.window.localStorage.getItem(key);
  assert.ok(raw, "Interaction should persist workspace data");
  assert.equal(
    h.window.validateWorkspace(JSON.parse(raw)),
    true,
    "Generated state must satisfy its schema",
  );
  const reloaded = await fixture(t, { saved: { [key]: raw } });
  assert.equal(
    reloaded.$("#storage-notice"),
    null,
    "Valid edits must not be discarded on reload",
  );
}
test("CSV protects user-authored cells against spreadsheet formulas", async (t) => {
  const h = await fixture(t);
  h.click("#addCaseButton");
  h.input("#newCaseName", "=1+1");
  h.input("#newCaseGoal", "Exercise safe CSV output");
  submit(h, "#caseForm");
  h.click("#exportCsvButton");
  const csv = await readBlob(h, h.downloads[0]);
  assert.ok(csv.includes('"\'=1+1"'));
  await roundTrip(t, h);
});
test("double-starting an evaluation creates one run", async (t) => {
  const h = await fixture(t);
  h.click("#runEvalButton");
  h.click("#runEvalButton");
  await h.wait(1600);
  assert.equal(JSON.parse(h.window.localStorage.getItem(key)).run, 25);
  assert.equal(h.$("#runOverlay").hidden, true);
});
