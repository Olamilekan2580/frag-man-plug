import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createPlatform} from './platform.mjs';
const sent=[];
const mailerFactory=()=>({configured:true,async send(m){sent.push(m);return true;}});
const db=new DatabaseSync(':memory:');
let t=Date.now();
const platform=createPlatform({db,body:async req=>req._body||{},send:(res,status,value)=>{res.status=status;res.value=value;},sameOrigin:req=>{const o=req.headers.origin;if(!o||new URL(o).host!==req.headers.host)throw Object.assign(new Error('Cross-origin'),{status:403});},now:()=>t,env:{},mailerFactory});
function req(path,method='GET',body,cookie=''){return {method,headers:{origin:'http://x',host:'x',cookie},socket:{remoteAddress:'127.0.0.1'},_body:body};}
function res(){const headers={};return {headers,setHeader(k,v){headers[k]=v;},getHeader(k){return headers[k];}};}
async function call(path,method,body,cookie){const r=res();try{await platform.route(req(path,method,body,cookie),r,new URL('http://x'+path));}catch(e){return {status:e.status||500,value:{error:e.message},cookie:r.getHeader('Set-Cookie')?.split(';')[0]};}return {status:r.status,value:r.value,cookie:r.getHeader('Set-Cookie')?.split(';')[0]};}
const tokenOf=text=>text.match(/token=([a-f0-9]{64})/)?.[1];
try{
 // Signup sends a verification email; merchant starts unverified.
 const signup=await call('/api/platform/signup','POST',{name:'Auth Merchant',email:'auth@example.com',password:'a-long-private-password'});
 assert.equal(signup.status,201);assert.equal(signup.value.merchant.emailVerified,false);assert.equal(signup.value.verificationSent,true);assert.equal(sent.length,1);assert.equal(sent[0].subject,"Verify your VEGArance merchant email");
 const cookie=signup.cookie;assert.ok(cookie);
 const session=await call('/api/platform/session','GET',undefined,cookie);assert.equal(session.value.merchant.emailVerified,false);
 // Publishing is blocked until email verification (mailer configured).
 const store=await call('/api/platform/stores','POST',{name:'Auth Store',slug:'auth-store'},cookie);assert.equal(store.status,201);const sid=store.value.id;
 assert.equal((await call('/api/platform/stores/'+sid,'PUT',{name:'Auth Store',description:'',supportEmail:'',accent:'#235949',published:true},cookie)).status,403);
 // Bad token rejected; real token verifies.
 assert.equal((await call('/api/platform/verify-email?token='+'0'.repeat(64),'GET')).status,400);
 const verifyToken=tokenOf(sent[0].text);assert.ok(verifyToken);
 assert.equal((await call('/api/platform/verify-email?token='+verifyToken,'GET')).status,200);
 assert.equal((await call('/api/platform/session','GET',undefined,cookie)).value.merchant.emailVerified,true);
 assert.equal((await call('/api/platform/stores/'+sid,'PUT',{name:'Auth Store',description:'',supportEmail:'',accent:'#235949',published:true},cookie)).status,200);
 // Token is single-use.
 assert.equal((await call('/api/platform/verify-email?token='+verifyToken,'GET')).status,400);
 // Already verified: resend reports verified, sends nothing new.
 assert.equal((await call('/api/platform/verify-email/request','POST',{},cookie)).value.verified,true);assert.equal(sent.length,1);
 // Forgot password: unknown email gets the same generic response, no email.
 assert.equal((await call('/api/platform/forgot-password','POST',{email:'nobody@example.com'})).value.sent,true);assert.equal(sent.length,1);
 assert.equal((await call('/api/platform/forgot-password','POST',{email:'auth@example.com'})).value.sent,true);assert.equal(sent.length,2);assert.equal(sent[1].subject,"Reset your VEGArance merchant password");
 const resetToken=tokenOf(sent[1].text);assert.ok(resetToken);
 assert.equal((await call('/api/platform/reset-password','POST',{token:'0'.repeat(64),password:'a-new-long-password'})).status,400);
 assert.equal((await call('/api/platform/reset-password','POST',{token:resetToken,password:'short'})).status,422);
 assert.equal((await call('/api/platform/reset-password','POST',{token:resetToken,password:'a-new-long-password'})).value.reset,true);
 // Old session is dead; old password fails; new password works.
 assert.equal((await call('/api/platform/stores','GET',undefined,cookie)).status,401);
 assert.equal((await call('/api/platform/login','POST',{email:'auth@example.com',password:'a-long-private-password'})).status,401);
 assert.equal((await call('/api/platform/login','POST',{email:'auth@example.com',password:'a-new-long-password'})).status,200);
 // Expired reset token is rejected.
 await call('/api/platform/forgot-password','POST',{email:'auth@example.com'});const expiring=tokenOf(sent.at(-1).text);t+=2*3600000;
 assert.equal((await call('/api/platform/reset-password','POST',{token:expiring,password:'another-long-password'})).status,400);
 // Without a configured mailer: signup succeeds, verification request is 503,
 // and publishing stays allowed (verification is inactive, not a lockout).
 const db2=new DatabaseSync(':memory:');const platform2=createPlatform({db:db2,body:async req=>req._body||{},send:(res,status,value)=>{res.status=status;res.value=value;},sameOrigin:()=>{},now:()=>Date.now(),env:{},mailerFactory:()=>({configured:false,async send(){throw new Error('no mailer');}})});
 async function call2(path,method,body,cookie){const r=res();try{await platform2.route(req(path,method,body,cookie),r,new URL('http://x'+path));}catch(e){return {status:e.status||500,value:{error:e.message},cookie:r.getHeader('Set-Cookie')?.split(';')[0]};}return {status:r.status,value:r.value,cookie:r.getHeader('Set-Cookie')?.split(';')[0]};}
 const s2=await call2('/api/platform/signup','POST',{name:'No Mail',email:'nomail@example.com',password:'a-long-private-password'});assert.equal(s2.status,201);assert.equal(s2.value.verificationSent,false);
 assert.equal((await call2('/api/platform/verify-email/request','POST',{},s2.cookie)).status,503);
 const st2=await call2('/api/platform/stores','POST',{name:'No Mail Store',slug:'no-mail-store'},s2.cookie);assert.equal(st2.status,201);
 assert.equal((await call2('/api/platform/stores/'+st2.value.id,'PUT',{name:'No Mail Store',description:'',supportEmail:'',accent:'#235949',published:true},s2.cookie)).status,200);
 console.log('PASS: merchant email verification, password recovery (generic responses, single-use hashed tokens, expiry, session invalidation), publish gate, no-mailer behaviour.');
}finally{db.close();}
