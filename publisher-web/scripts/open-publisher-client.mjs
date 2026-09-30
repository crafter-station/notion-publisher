export function connectionOptions() {
 const base=new URL(process.env.OPEN_PUBLISHER_URL||'http://localhost:3000');
 if(base.username||base.password||base.search||base.hash||(!['localhost','127.0.0.1','[::1]'].includes(base.hostname)&&base.protocol!=='https:'))throw new Error('OPEN_PUBLISHER_URL must be HTTPS (HTTP is allowed for loopback development only).');
 const token=process.env.OPEN_PUBLISHER_TOKEN;
 if(!token)throw new Error('Set OPEN_PUBLISHER_TOKEN to a credential created in Open Publisher.');
 const headers={Authorization:`Bearer ${token}`};
 const gate=process.env.OPEN_PUBLISHER_SITES_TOKEN;
 if(gate)headers['OAI-Sites-Authorization']=`Bearer ${gate}`;
 return {base,headers};
}
export async function request(path,method='GET',body,{binary=false}={}) {
 const {base,headers}=connectionOptions();
 const url=new URL(path,base);
 if(url.origin!==base.origin || !url.pathname.startsWith('/api/v1/'))throw new Error('Requests must target this Open Publisher API.');
 const response=await fetch(url,{method,redirect:'error',headers:{...headers,Accept:'application/json','Content-Type':binary?'application/octet-stream':'application/json'},...(body===undefined?{}:{body:binary?body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});
 let data;
 try {data=await response.json();} catch {
   throw new Error(response.status===401 ? '401 sites_sign_in_required: Private Sites require OPEN_PUBLISHER_SITES_TOKEN as well as OPEN_PUBLISHER_TOKEN.' : 'invalid_response: Open Publisher did not return API JSON.');
 }

 if(!response.ok)throw new Error(`${response.status} ${data.error?.code||'request_failed'}: ${data.error?.message||'Request failed.'}`);
 return data;
}
export const actions={
 sets:({after}={})=>request('/api/v1/sets'+(after?'?after='+encodeURIComponent(after):'')),
 verifySet:({id})=>request('/api/v1/sets/'+encodeURIComponent(id)+'/verify'),
 getSet:({id})=>request('/api/v1/sets/'+encodeURIComponent(id)),
 createSet:input=>request('/api/v1/sets','POST',input),
 updateSet:({id,...input})=>request('/api/v1/sets/'+encodeURIComponent(id),'PATCH',input),
 connections:()=>request('/api/v1/connections'),
 channels:()=>request('/api/v1/channels'),
 session:()=>request('/api/v1/session'),
 list:()=>request('/api/v1/drafts'),
 get:({id})=>request('/api/v1/drafts/'+encodeURIComponent(id)),
 create:input=>request('/api/v1/drafts','POST',input),
 update:({id,...input})=>request('/api/v1/drafts/'+encodeURIComponent(id),'PATCH',input),
 review:({id,...input})=>request('/api/v1/drafts/'+encodeURIComponent(id)+'/review','POST',input),
 notion:({cursor}={})=>request('/api/v1/notion'+(cursor?'?cursor='+encodeURIComponent(cursor):'')),
 importNotion:input=>request('/api/v1/notion/import','POST',input),
 compareNotion:({id})=>request('/api/v1/drafts/'+encodeURIComponent(id)+'/notion'),
 pullNotion:({id,...input})=>request('/api/v1/drafts/'+encodeURIComponent(id)+'/notion','POST',input),
 reconcileNotion:({id,...input})=>request('/api/v1/drafts/'+encodeURIComponent(id)+'/notion','PATCH',input),
 pushNotion:({id,...input})=>request('/api/v1/drafts/'+encodeURIComponent(id)+'/notion','PUT',input),
 typefullyStatus:({id})=>request('/api/v1/drafts/'+encodeURIComponent(id)+'/typefully'),
 createTypefullyDraft:({id,...input})=>request('/api/v1/drafts/'+encodeURIComponent(id)+'/typefully','POST',input),
};
