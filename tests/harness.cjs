const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");

async function boot({ saved, blocked = false } = {}) {
  const root = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error.message));
  const dom = new JSDOM(html, {
    url: "https://example.test/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  window.structuredClone = structuredClone;
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  window.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event("close"));
  };
  window.Element.prototype.scrollIntoView = function () {};
  window.Element.prototype.setPointerCapture = function () {};
  window.Element.prototype.releasePointerCapture = function () {};
  window.Element.prototype.animate = () => ({ finished: Promise.resolve() });
  window.scrollTo = () => {};
  window.confirm = () => true;
  window.prompt = () => null;
  window.HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy(
      {},
      {
        get: (_, key) =>
          key === "measureText"
            ? () => ({ width: 50 })
            : key === "createLinearGradient"
              ? () => ({ addColorStop() {} })
              : () => {},
      },
    );
  };
  const downloads = [];
  window.URL.createObjectURL = (blob) => {
    downloads.push(blob);
    return "blob:test";
  };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {};
  window.navigator.clipboard = {
    writeText: async (text) => {
      window.copiedText = text;
    },
  };
  if (saved)
    for (const [key, value] of Object.entries(saved))
      window.localStorage.setItem(key, value);
  if (blocked)
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new window.DOMException("Storage disabled", "SecurityError");
      },
    });
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  for (const script of window.document.querySelectorAll("script[src]")) {
    const source = script.getAttribute("src");
    if (/^https?:/.test(source))
      throw new Error("Runtime must not require a remote script");
    window.eval(
      fs.readFileSync(path.join(root, source), "utf8") +
        "\n//# sourceURL=" +
        source,
    );
  }
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  await new Promise((resolve) => window.setTimeout(resolve, 20));
  const $ = (selector) => window.document.querySelector(selector);
  const click = (selector) => {
    const element = $(selector);
    if (!element) throw new Error("Missing " + selector);
    element.click();
  };
  const input = (selector, value, type = "input") => {
    const element = $(selector);
    element.value = value;
    element.dispatchEvent(new window.Event(type, { bubbles: true }));
  };
  return {
    window,
    document: window.document,
    errors,
    downloads,
    $,
    click,
    input,
    close: () => window.close(),
    wait: (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
  };
}
module.exports = { boot };
