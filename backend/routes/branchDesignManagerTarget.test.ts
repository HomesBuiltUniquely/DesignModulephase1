/**
 * Pure checks for the branch Design Manager target floor.
 * Run: npx ts-node --transpile-only routes/branchDesignManagerTarget.test.ts
 */
import assert from "node:assert/strict";
import {
  INITIAL_BRANCH_MINIMUM_INR,
  applicableBranchTarget,
  authorizeBranchTargetWrite,
  initialBranchFloors,
  nextStoredMinimum,
  raiseBranchFloor,
} from "./incentivesRoutes";

const CRORE = 10_000_000;
const ONE_POINT_FOUR_CRORE = 1.4 * CRORE;
const ONE_POINT_FIVE_CRORE = INITIAL_BRANCH_MINIMUM_INR;
const TWO_CRORE = 2 * CRORE;

assert.equal(ONE_POINT_FIVE_CRORE, 1.5 * CRORE);

assert.equal(
  applicableBranchTarget(ONE_POINT_FIVE_CRORE, ONE_POINT_FOUR_CRORE),
  ONE_POINT_FIVE_CRORE,
  "achievement below the floor keeps the ₹1.5 crore minimum",
);
assert.equal(
  nextStoredMinimum(ONE_POINT_FIVE_CRORE, ONE_POINT_FOUR_CRORE),
  ONE_POINT_FIVE_CRORE,
  "a lower achievement does not decrease the stored minimum",
);

assert.equal(
  applicableBranchTarget(ONE_POINT_FIVE_CRORE, TWO_CRORE),
  TWO_CRORE,
  "achievement above the floor becomes the applicable target",
);
assert.equal(
  nextStoredMinimum(ONE_POINT_FIVE_CRORE, TWO_CRORE),
  TWO_CRORE,
  "reaching ₹2 crore raises the stored minimum",
);
assert.equal(
  nextStoredMinimum(TWO_CRORE, ONE_POINT_FIVE_CRORE),
  TWO_CRORE,
  "a submitted value below the stored minimum is ignored",
);

const afterHbr = raiseBranchFloor(initialBranchFloors(), "HBR", TWO_CRORE);
assert.equal(afterHbr.HBR, TWO_CRORE);
assert.equal(afterHbr.SJR, ONE_POINT_FIVE_CRORE, "Sarjapur stays independent of HBR");
assert.equal(afterHbr.JPN, ONE_POINT_FIVE_CRORE, "JP Nagar stays independent of HBR");

const afterJpnAttempt = raiseBranchFloor(afterHbr, "JPN", ONE_POINT_FOUR_CRORE);
assert.equal(afterJpnAttempt.JPN, ONE_POINT_FIVE_CRORE, "JP Nagar does not fall below its own floor");
assert.equal(afterJpnAttempt.HBR, TWO_CRORE, "raising checks on JP Nagar do not change HBR");

const admin = authorizeBranchTargetWrite({
  role: "admin",
  viewerId: 1,
  managerTerritorialDesignManagerId: 99,
  branchCode: "SJR",
});
assert.equal(admin.allowed, true);

const tdmOwn = authorizeBranchTargetWrite({
  role: "territorial_design_manager",
  viewerId: 7,
  managerTerritorialDesignManagerId: 7,
  branchCode: "HBR",
});
assert.equal(tdmOwn.allowed, true);

const tdmOther = authorizeBranchTargetWrite({
  role: "territorial_design_manager",
  viewerId: 7,
  managerTerritorialDesignManagerId: 8,
  branchCode: "JPN",
});
assert.equal(tdmOther.allowed, false);
if (!tdmOther.allowed) assert.equal(tdmOther.status, 403);

const tdmUnassigned = authorizeBranchTargetWrite({
  role: "territorial_design_manager",
  viewerId: 7,
  managerTerritorialDesignManagerId: null,
  branchCode: "HBR",
});
assert.equal(tdmUnassigned.allowed, false);
if (!tdmUnassigned.allowed) assert.equal(tdmUnassigned.status, 403);

const designManager = authorizeBranchTargetWrite({
  role: "design_manager",
  viewerId: 4,
  managerTerritorialDesignManagerId: 4,
  branchCode: "HBR",
});
assert.equal(designManager.allowed, false);
if (!designManager.allowed) assert.equal(designManager.status, 403);

const designer = authorizeBranchTargetWrite({
  role: "designer",
  viewerId: 5,
  managerTerritorialDesignManagerId: 7,
  branchCode: "SJR",
});
assert.equal(designer.allowed, false);
if (!designer.allowed) assert.equal(designer.status, 403);

console.log("branch design manager target checks passed");
