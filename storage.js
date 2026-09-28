/* Local-first persistence: never requires an account or a network request. */
(() => {
  "use strict";
  const memory = new Map();
  let persistent = true;
  let recovery = null;
  let message = "";
  const safeJSON = (value) => {
    if (value && typeof value === "object") {
      return Object.entries(value).every(
        ([key, child]) =>
          !["__proto__", "prototype", "constructor"].includes(key) &&
          safeJSON(child),
      );
    }
    return true;
  };
  function notice(text) {
    message = text;
    if (!document.body) return;
    let banner = document.getElementById("storage-notice");
    if (!banner) {
      banner = document.createElement("aside");
      banner.id = "storage-notice";
      banner.setAttribute("role", "status");
      document.body.append(banner);
    }
    banner.replaceChildren(document.createTextNode(message));
    if (recovery) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Download recovery file";
      button.addEventListener("click", () => {
        const url = URL.createObjectURL(
          new Blob([recovery], { type: "application/json" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "workspace-recovery.json";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      banner.append(button);
    }
  }
  window.WorkspaceStorage = Object.freeze({
    get persistent() {
      return persistent;
    },
    getItem(key) {
      let raw = memory.get(key) ?? null;
      if (persistent) {
        try {
          raw = localStorage.getItem(key);
        } catch {
          persistent = false;
          notice(
            "Session-only mode: browser storage is unavailable. Export your work before closing this tab.",
          );
        }
      }
      if (raw === null || key.endsWith(".theme")) return raw;
      try {
        const parsed = JSON.parse(raw);
        if (
          !parsed ||
          typeof parsed !== "object" ||
          !safeJSON(parsed) ||
          (typeof window.validateWorkspace === "function" &&
            !window.validateWorkspace(parsed))
        ) {
          throw new Error("Invalid workspace");
        }
        memory.set(key, raw);
        return raw;
      } catch {
        recovery = raw;
        try {
          if (!localStorage.getItem(key + ".recovery"))
            localStorage.setItem(key + ".recovery", raw);
        } catch {
          persistent = false;
        }
        notice(
          "The saved workspace could not be loaded. A fresh workspace is open; download the original data before repairing it.",
        );
        return null;
      }
    },
    setItem(key, value) {
      memory.set(key, String(value));
      if (persistent) {
        try {
          localStorage.setItem(key, value);
          return true;
        } catch {
          persistent = false;
        }
      }
      notice(
        "Session-only mode: changes are not saved to disk. Export your work before closing this tab.",
      );
      return false;
    },
    removeItem(key) {
      memory.delete(key);
      try {
        localStorage.removeItem(key);
      } catch {
        persistent = false;
      }
    },
  });
  document.addEventListener("DOMContentLoaded", () => {
    if (message) notice(message);
  });
})();
