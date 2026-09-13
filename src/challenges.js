import crypto from "node:crypto";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export class ChallengeStore {
  constructor({ttlMs=DEFAULT_TTL_MS,now=()=>Date.now()}={}) {
    this.ttlMs=ttlMs;
    this.now=now;
    this.items=new Map();
  }

  create(value) {
    this.prune();
    const id=crypto.randomUUID();
    const expiresAt=this.now()+this.ttlMs;
    this.items.set(id,{...value,expiresAt});
    return {id,expiresAt};
  }

  get(id) {
    const item=this.items.get(id);
    if(!item) return null;
    if(item.expiresAt<=this.now()) { this.delete(id); return null; }
    return item;
  }

  async delete(id) {
    const item=this.items.get(id);
    this.items.delete(id);
    await item?.client?.disconnect?.().catch(()=>{});
  }

  prune() {
    for(const [id,item] of this.items) if(item.expiresAt<=this.now()) void this.delete(id);
  }
}
