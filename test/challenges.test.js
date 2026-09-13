import assert from "node:assert/strict";
import test from "node:test";
import {ChallengeStore} from "../src/challenges.js";

test("challenges are scoped by TTL and disconnect on deletion",async()=>{
  let now=1000; let disconnected=0;
  const store=new ChallengeStore({ttlMs:100,now:()=>now});
  const {id}=store.create({client:{disconnect:async()=>{disconnected+=1}}});
  assert.ok(store.get(id));
  now=1101;
  assert.equal(store.get(id),null);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(disconnected,1);
});
