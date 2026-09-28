/* Validate persisted data before it reaches rendering or simulation. */
(() => {
  "use strict";
  const text = (v) => typeof v === "string" && v.length <= 100000;
  const id = (v) => text(v) && /^[a-zA-Z0-9_-]{1,120}$/.test(v);
  const number =
    (min = 0, max = 1e15) =>
    (v) =>
      Number.isFinite(v) && v >= min && v <= max;
  const bool = (v) => typeof v === "boolean";
  const one =
    (...values) =>
    (v) =>
      values.includes(v);
  const optional = (check) => (v) => v === undefined || check(v);
  const nullable = (check) => (v) => v === null || check(v);
  const array =
    (check, min = 0, max = 1000) =>
    (v) =>
      Array.isArray(v) && v.length >= min && v.length <= max && v.every(check);
  const object = (fields) => (v) =>
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.entries(fields).every(([key, check]) => check(v[key]));
  const record = (check) => (v) =>
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.values(v).every(check);
  const unique = (items) =>
    new Set(items.map((item) => item.id)).size === items.length;
  const model = one("aster", "nova", "orchid");
  window.validateWorkspace = object({
    run: number(0, 1e6),
    primaryModel: model,
    selectedModels: array(model, 1, 3),
    customCases: array(
      object({
        id,
        name: text,
        category: one(
          "Reasoning",
          "Safety",
          "Format",
          "Grounding",
          "Instruction",
        ),
        difficulty: one("Easy", "Medium", "Hard"),
        goal: text,
      }),
    ),
    previousOverall: number(0, 100),
    sort: object({
      key: one("name", "category", "difficulty", "score", "result"),
      direction: one("asc", "desc"),
    }),
  });
})();
