import http from "node:http";
import QRCode from "qrcode";
import {TelegramClient} from "telegram";
import {StringSession} from "telegram/sessions/index.js";
import {Api} from "telegram";
import {ChallengeStore} from "./challenges.js";
import {constantTimeBearer,requireIdentity} from "./security.js";

const apiId=Number(process.env.TELEGRAM_API_ID||0);
const apiHash=process.env.TELEGRAM_API_HASH||"";
const gatewaySecret=process.env.TELEGRAM_ACCOUNT_GATEWAY_SECRET||"";
const port=Number(process.env.PORT||8080);
const store=new ChallengeStore();

const reply=(res,status,body)=>{res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body));};
const readJson=async req=>{let body="";for await(const chunk of req){body+=chunk;if(body.length>16384)throw Object.assign(new Error("request_too_large"),{status:413});}return body?JSON.parse(body):{};};
const newClient=async()=>{const client=new TelegramClient(new StringSession(""),apiId,apiHash,{connectionRetries:3});await client.connect();return client;};
const scoped=(challenge,identity)=>challenge&&challenge.tenantId===identity.tenantId&&challenge.userId===identity.userId;

async function connectedResult(challenge,id){
  if(!challenge.account){
    const me=await challenge.client.getMe();
    challenge.account={
      account_id:String(me?.id||""),
      username:me?.username||null,
      display_name:[me?.firstName,me?.lastName].filter(Boolean).join(" ")||null,
    };
    if(!challenge.account.account_id) throw new Error("telegram_account_identity_unavailable");
  }
  challenge.status="connected";
  return {challenge_id:id,status:"connected",session:String(challenge.client.session.save()),...challenge.account};
}

async function startQr(identity){
  const client=await newClient();
  const qr=await client.invoke(new Api.auth.ExportLoginToken({apiId,apiHash,exceptIds:[]}));
  if(!(qr instanceof Api.auth.LoginToken)) throw new Error("telegram_qr_token_unavailable");
  const token=`tg://login?token=${Buffer.from(qr.token).toString("base64url")}`;
  const created=store.create({type:"qr",client,identity,status:"awaiting_scan",tenantId:identity.tenantId,userId:identity.userId,token});
  return {challenge_id:created.id,expires_at:new Date(Math.min(created.expiresAt,Number(qr.expires)*1000)).toISOString(),qr_image_data_url:await QRCode.toDataURL(token,{margin:1,width:320})};
}

async function startPhone(identity,phone){
  const normalized=String(phone||"").replace(/[\s()-]/g,"");
  if(!/^\+[1-9]\d{7,14}$/.test(normalized)) throw Object.assign(new Error("telegram_phone_invalid"),{status:400});
  const client=await newClient();
  const sent=await client.sendCode({apiId,apiHash},normalized);
  const created=store.create({type:"phone",client,phone:normalized,phoneCodeHash:sent.phoneCodeHash,status:"code_required",tenantId:identity.tenantId,userId:identity.userId});
  return {challenge_id:created.id,expires_at:new Date(created.expiresAt).toISOString(),next_step:"code"};
}

async function confirmPhone(identity,body){
  const challenge=store.get(String(body.challenge_id||""));
  if(!scoped(challenge,identity)||challenge.type!=="phone") throw Object.assign(new Error("telegram_challenge_not_found"),{status:404});
  if(challenge.status==="password_required"&&!body.password) return {challenge_id:body.challenge_id,next_step:"password"};
  try {
    if(challenge.status==="password_required") await challenge.client.signInWithPassword({password:async()=>String(body.password)});
    else await challenge.client.invoke(new Api.auth.SignIn({phoneNumber:challenge.phone,phoneCodeHash:challenge.phoneCodeHash,phoneCode:String(body.code||"")}));
  } catch(error) {
    if(error?.errorMessage==="SESSION_PASSWORD_NEEDED") { challenge.status="password_required"; return {challenge_id:body.challenge_id,next_step:"password"}; }
    throw error;
  }
  return connectedResult(challenge,body.challenge_id);
}

async function qrStatus(identity,id){
  const challenge=store.get(id);
  if(!scoped(challenge,identity)||challenge.type!=="qr") throw Object.assign(new Error("telegram_challenge_not_found"),{status:404});
  if(challenge.status==="connected") return connectedResult(challenge,id);
  try {
    const result=await challenge.client.invoke(new Api.auth.ImportLoginToken({token:Buffer.from(challenge.token.split("token=")[1],"base64url")}));
    if(result instanceof Api.auth.LoginTokenSuccess){return connectedResult(challenge,id);}
  } catch(error) {
    if(!["AUTH_TOKEN_INVALID","AUTH_TOKEN_EXPIRED"].includes(error?.errorMessage)) throw error;
    if(error?.errorMessage==="AUTH_TOKEN_EXPIRED") challenge.status="expired";
  }
  return {challenge_id:id,status:challenge.status};
}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.url==="/health"&&req.method==="GET") return reply(res,200,{ok:true});
    if(!constantTimeBearer(req,gatewaySecret)) return reply(res,401,{error:"gateway_authorization_failed"});
    const identity=requireIdentity(req);
    if(req.url==="/v1/auth/qr/start"&&req.method==="POST") return reply(res,200,await startQr(identity));
    if(req.url==="/v1/auth/phone/start"&&req.method==="POST") return reply(res,200,await startPhone(identity,(await readJson(req)).phone));
    if(req.url==="/v1/auth/phone/confirm"&&req.method==="POST") return reply(res,200,await confirmPhone(identity,await readJson(req)));
    const match=req.url?.match(/^\/v1\/auth\/qr\/([^/]+)\/status$/);
    if(match&&req.method==="GET") return reply(res,200,await qrStatus(identity,decodeURIComponent(match[1])));
    return reply(res,404,{error:"not_found"});
  }catch(error){console.error(error?.errorMessage||error?.message||error);reply(res,error?.status||502,{error:error?.message||"telegram_gateway_failed"});}
});

if(!apiId||!apiHash||!gatewaySecret) throw new Error("TELEGRAM_API_ID, TELEGRAM_API_HASH and TELEGRAM_ACCOUNT_GATEWAY_SECRET are required");
server.listen(port,"0.0.0.0",()=>console.log(`Telegram Account Gateway listening on ${port}`));
