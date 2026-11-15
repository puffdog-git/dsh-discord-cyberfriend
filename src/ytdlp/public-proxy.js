// Part of the YouTube music source bundled from a locally modified dsh-ytdlp.
// dsh-ytdlp is by tkwkeven (https://github.com/tkwkeven/dsh-ytdlp), MIT License;
// see docs/licenses/dsh-ytdlp-MIT.txt. This file was added in the local modification.
import http from 'node:http';
import net from 'node:net';
import dns from 'node:dns/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {sourceUrl,publicAddress} from './source-url.js';

// A short-lived, authenticated proxy. DNS is checked and pinned to the actual
// socket for every request/CONNECT, including redirects and CDN requests.
export async function startPublicProxy({lookup=dns.lookup,connect=net.connect,signal,maxBytes=512*1024*1024}={}){
  const token=randomBytes(24).toString('hex'),auth='Basic '+Buffer.from('job:'+token).toString('base64'),sockets=new Set();let closed=false,bytes=0;
  const tracked=s=>{sockets.add(s);s.on('error',()=>{});s.once('close',()=>sockets.delete(s));s.setTimeout?.(30000,()=>s.destroy());s.on('data',b=>{bytes+=b.length;if(bytes>maxBytes)for(const socket of sockets)socket.destroy()});return s};
  const authorized=req=>{const value=Buffer.from(String(req.headers['proxy-authorization']||'')),expected=Buffer.from(auth);return value.length===expected.length&&timingSafeEqual(value,expected)};
  async function socketFor(host,port){
    signal?.throwIfAborted();if(closed||sockets.size>32||bytes>maxBytes)throw Error('proxy unavailable');
    const records=await lookup(host,{all:true,verbatim:true});
    if(!records.length||records.some(r=>!publicAddress(r.address)))throw Error('private destination');
    signal?.throwIfAborted();if(closed)throw Error('proxy closed');const target=records[0];
    return await new Promise((resolve,reject)=>{const s=tracked(connect({host:target.address,port,family:target.family}));s.once('connect',()=>resolve(s));s.once('error',reject);s.once('timeout',()=>reject(Error('proxy timeout')))});
  }
  const server=http.createServer(async(req,res)=>{
    if(!authorized(req)){res.writeHead(407);res.end();return;}
    try{
      const u=new URL(sourceUrl(req.url));if(u.protocol!=='http:')throw Error('use CONNECT');
      const socket=await socketFor(u.hostname.replace(/^\[|\]$/g,''),80),headers={...req.headers,host:u.host,connection:'close'};delete headers['proxy-authorization'];delete headers['proxy-connection'];
      const agent=new http.Agent({keepAlive:false});agent.createConnection=()=>socket;
      const upstream=http.request({method:req.method,path:u.pathname+u.search,headers,agent},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res)});
      upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end()});req.on('aborted',()=>upstream.destroy());res.once('close',()=>upstream.destroy());req.pipe(upstream);
    }catch{if(!res.headersSent)res.writeHead(403);res.end('Public network policy rejected destination');}
  });
  server.on('connection',tracked);
  server.on('connect',async(req,client,head)=>{
    if(!authorized(req)){client.end('HTTP/1.1 407 Proxy Authentication Required\r\nConnection: close\r\n\r\n');return;}
    try{const u=new URL('https://'+req.url);sourceUrl(u.href);if((u.port&&u.port!=='443')||u.pathname!=='/'||u.search)throw Error('invalid tunnel');const target=await socketFor(u.hostname.replace(/^\[|\]$/g,''),443);if(client.destroyed){target.destroy();return;}client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)target.write(head);client.pipe(target);target.pipe(client);client.once('close',()=>target.destroy());target.once('close',()=>client.destroy());}catch{client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const close=async()=>{if(closed)return;closed=true;signal?.removeEventListener('abort',abort);for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));};
  const abort=()=>void close();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){await close();signal.throwIfAborted();}
  return {url:'http://job:'+token+'@127.0.0.1:'+server.address().port,close};
}

export const PUBLIC_YTDLP_ARGS=['--ignore-config','--no-plugin-dirs','--no-remote-components','--no-js-runtimes','--no-cache-dir','--downloader','native','--hls-prefer-native','--fixup','never','--max-filesize','256M','--postprocessor-args','ffmpeg_i:-protocol_whitelist file,pipe'];
