"use strict";

const assert = require("node:assert/strict");
const { countRepliesForPost } = require("./backfillCommunityReplyCounts");

function run() {
  assert.equal(typeof countRepliesForPost, "function");
  console.log("backfillCommunityReplyCounts unit test passed");
}

run();
