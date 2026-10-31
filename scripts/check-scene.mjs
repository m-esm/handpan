import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { LANDSCAPE, COURTYARD } from "../js/textures.js";
import { REST_SECONDS, writeCycle } from "../js/environments.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const main = readFileSync(resolve(root, "js/main.js"), "utf8");
const scene = readFileSync(resolve(root, "js/scene.js"), "utf8");

assert.ok(COURTYARD.length >= 8, "courtyard texture set");
assert.ok(LANDSCAPE.includes("ripples") && LANDSCAPE.includes("strata"), "landscape texture set");

assert.match(main, /textures\.ready\(COURTYARD/, "boot must gate on courtyard textures only");
assert.doesNotMatch(
  main,
  /textures\.ready\(\s*\[\s*\.\.\.COURTYARD\s*,\s*\.\.\.LANDSCAPE/,
  "boot must not wait on landscape textures before createStage",
);
assert.match(main, /ensureLandscape\(/, "boot must warm the valley after 3D is up");
assert.match(main, /Promise\.race\(/, "valley warm-up must not hang forever on texture baking");
assert.match(main, /simple\.no3d/, "WebGL-missing path must stay distinct");
assert.match(main, /simple\.failed/, "stage-failure path must stay distinct");

assert.match(scene, /async function ensureLandscape/, "valley must load through ensureLandscape");
assert.match(scene, /function dropLandscape/, "valley failures must fall back inside WebGL");
assert.match(scene, /landscape compile timeout/, "valley shader compile must time out instead of hanging");
assert.ok(
  !/let landscape = null;\s*try \{\s*landscape = createLandscape/.test(scene),
  "createWorld must not build the valley synchronously",
);
assert.match(scene, /ensureLandscape,/, "createWorld must export ensureLandscape");

const switchStart = scene.indexOf("  function showCourtyard() {");
const switchEnd = scene.indexOf("  function pose(time) {", switchStart);
assert.ok(switchStart >= 0 && switchEnd > switchStart, "scene switch functions exist");
const camera = { updateProjectionMatrix() {} };
const moonlight = { shadow: { camera }, position: { set() {} }, color: { setHex() {} } };
const position = { set() {}, copy() {} };
const state = {
  courtyard: { visible: true }, landscape: null, courtyardSelected: false,
  moonlight, moon: { position, material: { opacity: 1, color: { setHex() {} } } },
  moonHalo: { position, material: { opacity: 1 } },
  fogTone: { setHex() {} }, renderer: { shadowMap: {} }, compiled: false,
  probeMark: 0, shadowMark: null, pendingFrames: 0,
};
runInNewContext(scene.slice(switchStart, switchEnd), state);
state.selectCourtyard(true);
state.landscape = { group: { visible: false } };
state.selectCourtyard(state.courtyardSelected);
assert.equal(state.courtyard.visible, true, "late landscape loading must not replace a song courtyard");
assert.equal(state.landscape.group.visible, false);
state.selectCourtyard(false);
assert.equal(state.courtyard.visible, false, "library restores the landscape");
assert.equal(state.landscape.group.visible, true);
state.selectCourtyard(true);
assert.equal(state.courtyard.visible, true, "song navigation restores the courtyard");
assert.equal(state.landscape.group.visible, false);

const cycle = writeCycle(REST_SECONDS, {});
assert.ok(cycle.sunY > 0, "rest pose keeps the sun above the ridge");
assert.ok(Number.isFinite(cycle.fog) && cycle.fog > 0, "rest pose keeps fog");

console.log("Scene checks passed: courtyard-first boot, deferred valley, and isolated landscape failure path.");
