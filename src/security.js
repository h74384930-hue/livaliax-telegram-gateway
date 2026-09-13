import crypto from "node:crypto";

export function constantTimeBearer(request, expected) {
  if(!expected) return false;
  const value=request.headers.authorization?.replace(/^Bearer\s+/i,"")||"";
  const a=Buffer.from(value); const b=Buffer.from(expected);
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}

export function requireIdentity(request) {
  const tenantId=String(request.headers["x-livaliax-tenant-id"]||"").trim();
  const userId=String(request.headers["x-livaliax-user-id"]||"").trim();
  if(!tenantId||!userId) throw Object.assign(new Error("trusted_identity_required"),{status:401});
  return {tenantId,userId};
}
