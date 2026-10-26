import { useEffect, useRef } from "react";
import * as THREE from "three";

// ══════════════════════════════════════════════════════════════════
// 🌉 PODUL DE STICLĂ — scena 3D (aprobată din prototip), legată de server.
//
// Scena NU cunoaște traseul: la atingerea unui panou cheamă onPick(row, side),
// care trimite cererea la server; animația săriturii acoperă timpul de răspuns,
// apoi rezultatul serverului decide: panoul rezistă sau se sparge.
// După fiecare cădere, toate cele 18 panouri revin identice (fără indicii).
// Resursele (om, coafuri, sunete reale CC0) vin din /public/bridge/*.json.
// ══════════════════════════════════════════════════════════════════

export function createBridgeScene(container, assets, opts) {
const T = THREE;

const canvas=document.createElement('canvas');canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none';container.appendChild(canvas);
let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){container.removeChild(canvas);return null;}
const LOW=(navigator.hardwareConcurrency||8)<6;
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,LOW?1.25:1.75));
renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
renderer.physicallyCorrectLights=true;renderer.shadowMap.enabled=!LOW;renderer.shadowMap.type=T.PCFSoftShadowMap;

const scene=new T.Scene();scene.background=new T.Color(0x03080a);scene.fog=new T.FogExp2(0x041012,0.028);
const camera=new T.PerspectiveCamera(58,1,0.05,400);

// ── Mediu pentru reflexii ──
(function(){const env=new T.Scene();env.add(new T.Mesh(new T.SphereGeometry(20,24,12),new T.MeshBasicMaterial({color:0x061214,side:T.BackSide})));
 const pnl=(w,h,c,x,y,z,ry,rx)=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:c,side:T.DoubleSide}));m.position.set(x,y,z);m.rotation.y=ry||0;m.rotation.x=rx||0;env.add(m);};
 pnl(14,3,0xfff1d6,0,14,0,0,Math.PI/2);pnl(3,10,0xff3d86,-14,2,0,Math.PI/2);pnl(3,10,0x39e0bd,14,2,0,-Math.PI/2);pnl(10,2,0xffd27a,0,4,-18,0);
 const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(env,0.04).texture;pm.dispose();})();

// ── Geometria podului ──
const ROWS=9, ROW_GAP=2.6, PANEL=1.25, SIDE_X=0.95, START_Z=2.5;
const rowZ=(i)=>-i*ROW_GAP-ROW_GAP; // rândul i
const steel=new T.MeshStandardMaterial({color:0x2b3438,metalness:0.85,roughness:0.42});
const steelDark=new T.MeshStandardMaterial({color:0x171d20,metalness:0.8,roughness:0.55});
const rust=new T.MeshStandardMaterial({color:0x15191b,metalness:0.9,roughness:0.55});

// Lumini
scene.add(new T.HemisphereLight(0x5a7a80,0x020304,0.6));
const key=new T.SpotLight(0xfff0d8,420,60,Math.PI/6,0.7,1.8);key.position.set(0,16,4);key.castShadow=!LOW;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-0.0004;scene.add(key,key.target);
const pinkL=new T.PointLight(0xff2d7a,60,40,2);pinkL.position.set(-9,6,-12);scene.add(pinkL);
const tealL=new T.PointLight(0x2fbf9a,60,40,2);tealL.position.set(9,5,-16);scene.add(tealL);
const endL=new T.PointLight(0xffd27a,40,18,2);endL.position.set(0,3,rowZ(ROWS)-2);scene.add(endL);

// Hala: coloane, grinzi, pasarele (instanțiate — ieftin pe telefon)
(function(){
 const colGeo=new T.BoxGeometry(0.8,60,0.8);const cols=new T.InstancedMesh(colGeo,steelDark,16);let k=0;
 for(let i=0;i<8;i++)for(const x of[-11,11]){const m=new T.Matrix4().makeTranslation(x,-12,8-i*7);cols.setMatrixAt(k++,m);}scene.add(cols);
 const beamGeo=new T.BoxGeometry(23,0.6,0.6);const beams=new T.InstancedMesh(beamGeo,steel,8);for(let i=0;i<8;i++)beams.setMatrixAt(i,new T.Matrix4().makeTranslation(0,15,8-i*7));scene.add(beams);
 const diagGeo=new T.BoxGeometry(0.18,9,0.18);const diag=new T.InstancedMesh(diagGeo,steel,28);k=0;
 for(let i=0;i<7;i++)for(const x of[-11,11])for(const s of[1,-1]){if(k>=28)break;const m=new T.Matrix4().compose(new T.Vector3(x,6,4.5-i*7),new T.Quaternion().setFromEuler(new T.Euler(s*0.6,0,0)),new T.Vector3(1,1,1));diag.setMatrixAt(k++,m);}scene.add(diag);
 // lămpi industriale suspendate
 const lampGeo=new T.ConeGeometry(0.7,0.6,24,1,true);const lampMat=new T.MeshStandardMaterial({color:0x111111,metalness:.7,roughness:.4,side:T.DoubleSide});
 const bulbMat=new T.MeshBasicMaterial({color:0xfff2cc});
 for(let i=0;i<5;i++){const g=new T.Group();const l=new T.Mesh(lampGeo,lampMat);const b=new T.Mesh(new T.SphereGeometry(0.22,12,8),bulbMat);b.position.y=-0.2;g.add(l,b);g.position.set(i%2?3.5:-3.5,9,1-i*6);scene.add(g);}
 // conuri de lumină (aditive)
 const beamMat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,uniforms:{c:{value:new T.Color(0xfff0c8)}},
  vertexShader:'varying float vY;void main(){vY=position.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 c;varying float vY;void main(){float a=smoothstep(-6.,6.,vY)*0.06;gl_FragColor=vec4(c,a);}'});
 for(let i=0;i<5;i++){const c=new T.Mesh(new T.CylinderGeometry(0.4,3.2,12,32,1,true),beamMat);c.position.set(i%2?3.5:-3.5,3,1-i*6);scene.add(c);}
 // benzi de neon în depărtare
 const neon=(col,x,y,z,w)=>{const m=new T.Mesh(new T.BoxGeometry(w,0.12,0.12),new T.MeshBasicMaterial({color:col}));m.position.set(x,y,z);scene.add(m);};
 neon(0xff2d7a,-10.5,3,-30,0.2);for(let i=0;i<6;i++){neon(i%2?0x2fbf9a:0xff2d7a,i%2?10.6:-10.6,8,4-i*7,0.15);}
 // golul: podeaua foarte jos, cu o strălucire slabă
 const abyss=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshBasicMaterial({color:0x020405}));abyss.rotation.x=-Math.PI/2;abyss.position.y=-45;scene.add(abyss);
 const glow=new T.Mesh(new T.CircleGeometry(14,48),new T.MeshBasicMaterial({color:0x0b3a33,transparent:true,opacity:.35,blending:T.AdditiveBlending,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.set(0,-44.8,-12);scene.add(glow);
})();

// Structura podului: grinzi laterale, traverse, platforme
(function(){
 const L=ROWS*ROW_GAP+4;
 for(const x of[-2.0,0,2.0]){const r=new T.Mesh(new T.BoxGeometry(x===0?0.14:0.22,0.28,L),steel);r.position.set(x,-0.2,-L/2+1);r.castShadow=!LOW;scene.add(r);}
 for(let i=0;i<=ROWS;i++){const z=rowZ(i)+ROW_GAP/2;const t=new T.Mesh(new T.BoxGeometry(4.3,0.18,0.22),steel);t.position.set(0,-0.22,z);scene.add(t);
  // cabluri spre tavan
  for(const x of[-2.05,2.05]){const c=new T.Mesh(new T.CylinderGeometry(0.02,0.02,16,6),steel);c.position.set(x,7.8,z);scene.add(c);}}
 const plate=(z,d)=>{const p=new T.Mesh(new T.BoxGeometry(4.6,0.35,d),rust);p.position.set(0,-0.18,z);p.receiveShadow=true;scene.add(p);
  for(const x of[-2.2,2.2]){const rail=new T.Mesh(new T.BoxGeometry(0.06,1,d),steel);rail.position.set(x,0.5,z);scene.add(rail);}};
 plate(START_Z-0.5,4);plate(rowZ(ROWS)-2.4,4.2);
 // poarta finală luminoasă
 const gate=new T.Mesh(new T.TorusGeometry(1.6,0.08,8,48,Math.PI),new T.MeshBasicMaterial({color:0xffd27a}));gate.position.set(0,0,rowZ(ROWS)-3.8);scene.add(gate);
})();

// ── Sticla ──
const glassMat=()=>new T.MeshPhysicalMaterial({color:0xcff7ee,metalness:0,roughness:0.04,transparent:true,opacity:0.22,clearcoat:1,clearcoatRoughness:0.03,envMapIntensity:2.4,depthWrite:false});
const frameMat=new T.MeshStandardMaterial({color:0x8fa3a6,metalness:1,roughness:0.25});
const rimMat=()=>new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{c:{value:new T.Color(0x9ff5df)},a:{value:0.35}},
  vertexShader:'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 c;uniform float a;varying vec2 vU;void main(){float e=min(min(vU.x,1.-vU.x),min(vU.y,1.-vU.y));float g=smoothstep(0.08,0.0,e);gl_FragColor=vec4(c,g*a);}'});
const panels=[]; // [row][side] = {group, glass, rim, crack, ...}
function crackTexture(){const c=document.createElement('canvas');c.width=c.height=512;const t=new T.CanvasTexture(c);return {c,t,g:c.getContext('2d'),lines:null};}
function buildCracks(ct,cx,cy){const lines=[];const branch=(x,y,a,len,d)=>{if(d>5||len<12)return;const nx=x+Math.cos(a)*len,ny=y+Math.sin(a)*len;lines.push([x,y,nx,ny,d]);const n=d<2?3:2;for(let i=0;i<n;i++)branch(nx,ny,a+(Math.random()-.5)*1.2,len*(0.55+Math.random()*0.25),d+1);};
 for(let i=0;i<9;i++)branch(cx,cy,i/9*Math.PI*2+Math.random()*.4,70+Math.random()*60,0);
 for(let r=30;r<200;r+=45){const pts=24;for(let i=0;i<pts;i++){if(Math.random()<.45)continue;const a1=i/pts*Math.PI*2,a2=(i+1)/pts*Math.PI*2;const rr=r+Math.random()*12;lines.push([cx+Math.cos(a1)*rr,cy+Math.sin(a1)*rr,cx+Math.cos(a2)*rr,cy+Math.sin(a2)*rr,3]);}}
 ct.lines=lines;}
function drawCracks(ct,p){const g=ct.g;g.clearRect(0,0,512,512);g.lineCap='round';const n=Math.floor(ct.lines.length*p);
 for(let i=0;i<n;i++){const [x1,y1,x2,y2,d]=ct.lines[i];g.shadowColor='rgba(200,255,245,0.9)';g.shadowBlur=6;g.strokeStyle=`rgba(255,255,255,${1-d*0.08})`;g.lineWidth=Math.max(1.4,5-d*0.7);g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();}
 ct.t.needsUpdate=true;}
for(let i=0;i<ROWS;i++){panels[i]=[];for(const side of[0,1]){
 const g=new T.Group();g.position.set(side?SIDE_X:-SIDE_X,0,rowZ(i));scene.add(g);
 const gl=new T.Mesh(new T.BoxGeometry(PANEL,0.07,PANEL),glassMat());gl.renderOrder=2;gl.userData={row:i,side};g.add(gl);
 const rim=new T.Mesh(new T.PlaneGeometry(PANEL,PANEL),rimMat());rim.rotation.x=-Math.PI/2;rim.position.y=0.04;rim.renderOrder=3;g.add(rim);
 // ramă metalică
 for(const [w,d,x,z] of[[PANEL+0.08,0.06,0,PANEL/2],[PANEL+0.08,0.06,0,-PANEL/2],[0.06,PANEL,PANEL/2,0],[0.06,PANEL,-PANEL/2,0]]){const f=new T.Mesh(new T.BoxGeometry(w,0.09,d),frameMat);f.position.set(x,0,z);g.add(f);}
 const ct=crackTexture();const crack=new T.Mesh(new T.PlaneGeometry(PANEL,PANEL),new T.MeshBasicMaterial({map:ct.t,transparent:true,depthWrite:false,opacity:0.95}));crack.rotation.x=-Math.PI/2;crack.position.y=0.045;crack.visible=false;crack.renderOrder=4;g.add(crack);
 panels[i][side]={g,gl,rim,crack,ct,broken:false};}}

// Cioburi: triunghiuri dintr-o subdivizare aleatoare a pătratului
const shardMat=new T.MeshPhysicalMaterial({color:0xe9fffa,roughness:0.03,transparent:true,opacity:0.8,clearcoat:1,envMapIntensity:3.2,emissive:0x3a6f66,emissiveIntensity:0.35,side:T.DoubleSide,depthWrite:false});
const shards=[];
const sparkTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(200,255,245,.7)');r.addColorStop(1,'rgba(150,255,230,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new T.CanvasTexture(c);})();
const glitter=[];
function burstGlitter(pos){const n=90,geo=new T.BufferGeometry(),pa=new Float32Array(n*3),vel=[];for(let i=0;i<n;i++){pa[i*3]=pos.x+(Math.random()-.5)*1.1;pa[i*3+1]=pos.y;pa[i*3+2]=pos.z+(Math.random()-.5)*1.1;vel.push(new T.Vector3((Math.random()-.5)*3,Math.random()*2.5,(Math.random()-.5)*3));}
 geo.setAttribute('position',new T.BufferAttribute(pa,3));const pts=new T.Points(geo,new T.PointsMaterial({size:0.07,map:sparkTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));scene.add(pts);glitter.push({pts,vel,life:2.2});}
function shatter(p){
 p.gl.visible=false;p.rim.visible=false;p.crack.visible=false;p.broken=true;
 const h=PANEL/2;let tris=[[[-h,-h],[h,-h],[0,0]],[[h,-h],[h,h],[0,0]],[[h,h],[-h,h],[0,0]],[[-h,h],[-h,-h],[0,0]]];
 for(let it=0;it<3;it++){const nt=[];tris.forEach(t=>{const a=Math.floor(Math.random()*3),b=(a+1)%3,c=(a+2)%3;const r=0.35+Math.random()*.3;const m=[t[a][0]+(t[b][0]-t[a][0])*r,t[a][1]+(t[b][1]-t[a][1])*r];nt.push([t[a],m,t[c]],[m,t[b],t[c]]);});tris=nt;}
 const wp=new T.Vector3();p.g.getWorldPosition(wp);
 tris.forEach(t=>{const sh=new T.Shape();sh.moveTo(t[0][0],t[0][1]);sh.lineTo(t[1][0],t[1][1]);sh.lineTo(t[2][0],t[2][1]);
  const geo=new T.ExtrudeGeometry(sh,{depth:0.04,bevelEnabled:false});geo.rotateX(Math.PI/2);
  const cx=(t[0][0]+t[1][0]+t[2][0])/3,cz=(t[0][1]+t[1][1]+t[2][1])/3;geo.translate(-cx,0,-cz);
  const m=new T.Mesh(geo,shardMat);m.position.set(wp.x+cx,wp.y,wp.z+cz);scene.add(m);
  shards.push({m,v:new T.Vector3(cx*2.2+(Math.random()-.5),Math.random()*1.2+0.4,cz*2.2+(Math.random()-.5)),w:new T.Vector3((Math.random()-.5)*10,(Math.random()-.5)*10,(Math.random()-.5)*10),life:4});});
 burstGlitter(wp);
}

// ── Personajul (articulat, construit în cod) ──
function numberTex(num,name){const c=document.createElement('canvas');c.width=256;c.height=256;const g=c.getContext('2d');
 g.fillStyle='#15624b';g.fillRect(0,0,256,256);g.fillStyle='#fff';g.font='800 120px Oswald,Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(num,128,138);
 const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;return t;}
function badgeTex(src){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;
 const im=new Image();im.onload=()=>{g.clearRect(0,0,128,128);g.save();g.beginPath();g.arc(64,64,58,0,Math.PI*2);g.clip();g.drawImage(im,0,0,128,128);g.restore();g.strokeStyle='#fff';g.lineWidth=8;g.beginPath();g.arc(64,64,58,0,Math.PI*2);g.stroke();t.needsUpdate=true;};im.src=src;return t;}
function labelSprite(text,color){const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');
 g.font='800 52px Inter,Arial';const w=g.measureText(text).width+60;g.fillStyle='rgba(0,0,0,.55)';const x=(512-w)/2;g.beginPath();g.roundRect?g.roundRect(x,22,w,84,42):g.rect(x,22,w,84);g.fill();
 g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,66);const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;
 const s=new T.Sprite(new T.SpriteMaterial({map:t,transparent:true,depthWrite:false}));s.scale.set(1.6,0.4,1);return s;}
// ══ OM PROFESIONIST: Quaternius „Universal Base Characters” (CC0), convertit din USD.
// Mesh de ~6.300 de puncte cu schelet de 65 de oase. Animațiile sunt făcute de mine,
// pe articulațiile reale (bazin, coloană, umeri, coate, încheieturi, degete, șolduri,
// genunchi, glezne), în spațiul personajului — fără rotații „inversate”.
function b64(s,Type){const bin=atob(s),u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);return new Type(u8.buffer);}
const HUMAN=assets.human,HAIRS=assets.hairs,SFX=assets.sfx;
const HD={pos:b64(HUMAN.pos,Float32Array),si:b64(HUMAN.si,Uint8Array),sw:b64(HUMAN.sw,Uint8Array),idx:b64(HUMAN.idx,Uint16Array),hp:b64(HUMAN.hairPos,Float32Array),hi:b64(HUMAN.hairIdx,Uint16Array)};
// Roluri Sezonul 3: aceeași anatomie, costume diferite (culori + glugă).
const ROLES={
 player:{suit:0x1b6b52,dark:0x14503e,stripe:0xf4f4f0,shoe:0xf2f2ee,hood:null},
 guard:{suit:0xd8336f,dark:0xa8204f,stripe:0xd8336f,shoe:0x151515,hood:0x0b0b0b},      // paznic: salopetă roz, glugă/mască neagră
 vip:{suit:0x1a1a1e,dark:0xb8902e,stripe:0x1a1a1e,shoe:0x0d0d0d,hood:null},             // sponsor: costum închis, accente aurii
 boss:{suit:0x0c0c0e,dark:0x1c1c20,stripe:0x0c0c0e,shoe:0x080808,hood:0x050505},        // șeful: negru complet, glugă neagră
};
const BASE_GEO=(()=>{
 const g=new T.BufferGeometry();const P=new Float32Array(HD.pos);g.setAttribute('position',new T.BufferAttribute(P,3));g.setIndex(new T.BufferAttribute(HD.idx,1));g.computeVertexNormals();
 const n=g.attributes.normal.array,cnt=P.length/3,col=new Float32Array(cnt*3);
 const si=new Uint16Array(cnt*4),sw=new Float32Array(cnt*4);for(let i=0;i<cnt*4;i++){si[i]=HD.si[i];sw[i]=HD.sw[i]/255;}
 const C=(h)=>new T.Color(h).convertSRGBToLinear();
 const SUIT=C(0x1b6b52),SUITD=C(0x14503e),SKIN=C(0xc58f6c),SHOE=C(0xf2f2ee),WHITE=C(0xf4f4f0);
 const regionOf=new Uint8Array(cnt); // 0 trening, 1 piele, 2 pantof, 3 dungă, 4 guler/manșetă
 for(let i=0;i<cnt;i++){
  const nm=HUMAN.names[HD.si[i*4]];const x=P[i*3],y=P[i*3+1],nx=n[i*3],ny=n[i*3+1];
  let c=SUIT,inflate=0.011;
  if(nm==='Head'||(nm==='neck_01'&&y>1.53)){c=SKIN;inflate=0;}
  else if(/^(hand|index|middle|pinky|ring|thumb)/.test(nm)){c=SKIN;inflate=0;}
  else if(/^(foot|ball)/.test(nm)){c=SHOE;inflate=0.008;}
  else if(/^(upperarm|lowerarm)/.test(nm)&&ny>0.93){c=WHITE;}                 // dunga albă pe exteriorul brațului (în poza de referință, sus)
  else if(/^(thigh|calf)/.test(nm)&&((nm.endsWith('_l')&&nx<-0.9)||(nm.endsWith('_r')&&nx>0.9))){c=WHITE;} // dunga de pe exteriorul piciorului
  else if(nm==='neck_01'||(nm==='spine_03'&&y>1.47)){c=SUITD;}                 // gulerul
  if(/^lowerarm/.test(nm)&&Math.abs(x)>0.66){c=SUITD;}                         // manșeta
  if(/^calf/.test(nm)&&y<0.17&&c!==SHOE){c=SUITD;}                             // tivul pantalonului
  col.set([c.r,c.g,c.b],i*3);regionOf[i]=c===SKIN?1:c===SHOE?2:c===WHITE?3:c===SUITD?4:0;
  P[i*3]+=nx*inflate;P[i*3+1]+=ny*inflate;P[i*3+2]+=n[i*3+2]*inflate;           // treningul are volum, nu e lipit de corp
 }
 g.computeVertexNormals();g.setAttribute('color',new T.BufferAttribute(col,3));g.setAttribute('skinIndex',new T.BufferAttribute(si,4));g.setAttribute('skinWeight',new T.BufferAttribute(sw,4));
 g.userData.regionOf=regionOf;return g;})();
const ROLE_GEO={};
function geoForRole(role){if(ROLE_GEO[role])return ROLE_GEO[role];const r=ROLES[role]||ROLES.player;if(role==='player'){ROLE_GEO.player=BASE_GEO;return BASE_GEO;}
 const g=BASE_GEO.clone();const reg=BASE_GEO.userData.regionOf,col=g.attributes.color.array.slice();const C=(h)=>new T.Color(h).convertSRGBToLinear();
 const map={0:C(r.suit),2:C(r.shoe),3:C(r.stripe),4:C(r.dark)};for(let i=0;i<reg.length;i++){const c=map[reg[i]];if(c){col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}}
 g.setAttribute('color',new T.BufferAttribute(col,3));ROLE_GEO[role]=g;return g;}
const HAIR_GEOS=Object.fromEntries(Object.entries(HAIRS).map(([k,v])=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(b64(v.p,Float32Array),3));g.setIndex(new T.BufferAttribute(b64(v.i,Uint16Array),1));g.computeVertexNormals();return [k,g];}));
const HAIR_COLORS={negru:0x120d0a,castaniu:0x3b2416,blond:0x9c7a45,grizonat:0x6f6a64};
const HAIR_GEO=(()=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(HD.hp,3));g.setIndex(new T.BufferAttribute(HD.hi,1));g.computeVertexNormals();return g;})();
function makeHuman({num,name,ghost=false,showLabel=true,role='player',hair='parted',hairColor='negru'}){
 const op=ghost?0.5:1;
 const bones=HUMAN.names.map(n=>{const b=new T.Bone();b.name=n;return b;});
 const m4=new T.Matrix4();bones.forEach((b,i)=>{m4.fromArray(HUMAN.local,i*16);m4.decompose(b.position,b.quaternion,b.scale);});
 bones.forEach((b,i)=>{const p=HUMAN.parent[i];if(p>=0)bones[p].add(b);});
 const skel=new T.Skeleton(bones,HUMAN.names.map((_,i)=>new T.Matrix4().fromArray(HUMAN.inv,i*16)));
 const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:0.86,metalness:0,transparent:ghost,opacity:op,depthWrite:!ghost});
 const mesh=new T.SkinnedMesh(geoForRole(role),mat);mesh.add(bones[0]);mesh.bind(skel);mesh.castShadow=!ghost;mesh.frustumCulled=false;
 const root=new T.Group(),inner=new T.Group();root.add(inner);inner.add(mesh);
 const B={};bones.forEach(b=>B[b.name]=b);
 const hairMat=new T.MeshStandardMaterial({color:HAIR_COLORS[hairColor]||0x120d0a,roughness:0.9,side:T.DoubleSide,transparent:ghost,opacity:op,depthWrite:!ghost});
 // stratul de bază (scalpul tuns scurt) e mereu pus, ca să nu se vadă pielea prin coafură
 const hairMesh=new T.Group();
 // scalpul: calotă în culoarea părului care acoperă creștetul și ceafa (modelul original o avea pictată în textură)
 const hq0=new T.Quaternion();B.Head.getWorldQuaternion(hq0);hq0.invert();
 const scalp=new T.Mesh(new T.SphereGeometry(0.112,28,20,0,Math.PI*2,0,Math.PI*0.6),hairMat);scalp.quaternion.copy(hq0);
 scalp.position.copy(B.Head.worldToLocal(new T.Vector3(0,1.676,0.016)));scalp.scale.set(1.02,1.3,1.07);hairMesh.add(scalp);
 const style=new T.Mesh(HAIR_GEOS[hair]||HAIR_GEOS.parted,hairMat);style.scale.setScalar(1.03);hairMesh.add(style);
 B.Head.add(hairMesh);
 // glugă (paznic, șef): calotă care acoperă capul
 const hoodC=(ROLES[role]||{}).hood;let hood=null;if(hoodC!=null){hood=new T.Mesh(new T.SphereGeometry(0.125,28,20,0,Math.PI*2,0,Math.PI*0.62),new T.MeshStandardMaterial({color:hoodC,roughness:0.8,transparent:ghost,opacity:op}));
  const hq=new T.Quaternion();B.Head.getWorldQuaternion(hq);hood.quaternion.copy(hq.invert());hood.position.copy(B.Head.worldToLocal(new T.Vector3(0,1.66,0.012)));hood.scale.set(1.08,1.3,1.12);B.Head.add(hood);hairMesh.visible=false;}
 mesh.updateMatrixWorld(true);
 // numărul pe spate, lipit de vertebra de sus
 const nt=numberTex(num,null,role);const deco=new T.Mesh(new T.PlaneGeometry(0.24,0.24),new T.MeshStandardMaterial({map:nt,roughness:.85,transparent:true,opacity:op,polygonOffset:true,polygonOffsetFactor:-2}));
 let maxZ=0;const P=BASE_GEO.attributes.position.array;for(let i=0;i<P.length;i+=3){if(Math.abs(P[i])<0.07&&P[i+1]>1.25&&P[i+1]<1.36)maxZ=Math.max(maxZ,P[i+2]);}
 const sp=B.spine_03;const wq=new T.Quaternion();sp.getWorldQuaternion(wq);deco.position.copy(sp.worldToLocal(new T.Vector3(0,1.3,maxZ+0.006)));deco.quaternion.copy(wq.invert());sp.add(deco);
 const restL={},restW={};bones.forEach(b=>{restL[b.name]=b.quaternion.clone();const q=new T.Quaternion();b.getWorldQuaternion(q);restW[b.name]=q;});
 const label=labelSprite(`${num} · ${name}`,ghost?'#9ff5df':'#ffffff');label.position.y=2.12;label.visible=showLabel;root.add(label);
 if(role!=='player')deco.visible=false; // numărul pe spate doar la jucători
 return {root,inner,mesh,B,restL,restW,roll:0,hairMesh,role};
}
const D2R=Math.PI/180,_e=new T.Euler(),_q=new T.Quaternion(),_qi=new T.Quaternion();
// rotație în axele PERSONAJULUI (X = dreapta lui, Y = sus, Z = spre spate), aplicată în cadrul de repaus al osului
function rot(h,n,x,y,z){const b=h.B[n];if(!b)return;_e.set(x*D2R,y*D2R,z*D2R,'XYZ');_q.setFromEuler(_e);_qi.copy(h.restW[n]).invert();
 b.quaternion.copy(h.restL[n]).multiply(_qi.multiply(_q).multiply(h.restW[n]));}
// Poze: grade. sp = aplecare înainte, hd = cap în jos, aD = brațe coborâte (90 = pe lângă corp),
// aF = brațe înainte, el = cot, th = coapsă înainte, kn = genunchi, fi = degete strânse.
const BASEP={sp:0,hd:0,aD:80,aF:0,el:12,th:0,kn:0,fi:16,thL:0,thR:0,knL:0,knR:0,aFL:0,aFR:0,air:0,cl:0};
const PZ=(o)=>Object.assign({},BASEP,o);
const POSES={
 idle:PZ({sp:3,hd:2,aD:80,aF:5,el:14,kn:4,fi:20}),
 crouch:PZ({sp:30,hd:-14,aD:76,aF:-38,el:22,th:56,kn:98,fi:22}),
 air:PZ({sp:10,hd:-4,aD:42,aF:72,el:34,th:44,kn:78,thL:12,knL:16,thR:-10,knR:-20,fi:10,air:1}),
 land:PZ({sp:28,hd:-6,aD:56,aF:26,el:30,th:46,kn:82,fi:18}),
 balance:PZ({sp:10,hd:6,aD:38,aF:14,el:26,th:10,kn:18,fi:10}),
 relief:PZ({sp:20,hd:26,aD:86,aF:4,el:8,th:4,kn:8,fi:24,cl:-6}),
 flail:PZ({sp:-16,hd:-22,aD:-12,aF:38,el:48,th:30,kn:52,thL:12,knL:22,thR:-34,knR:-40,fi:4,air:1}),
};
const mixPose=(a,b,t)=>{const o={};for(const k in a)o[k]=a[k]+(b[k]-a[k])*t;return o;};
const ease=(t)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const L1=0.429,L2=0.456;
function applyPose(h,p,ph=0,walk=0){
 const br=Math.sin(ph)*1.2;                       // respirație
 const sw=walk?Math.sin(walk):0;                  // ciclul de mers
 rot(h,'pelvis',0,0,h.roll*0.4);
 rot(h,'spine_01',-p.sp*0.3,0,h.roll*0.3);rot(h,'spine_02',-p.sp*0.35,0,h.roll*0.3);rot(h,'spine_03',-p.sp*0.35-br*0.6,0,h.roll*0.4);
 rot(h,'neck_01',-p.hd*0.45+p.sp*0.25,0,0);rot(h,'Head',-p.hd*0.55,0,0);
 rot(h,'clavicle_l',0,0,p.cl+br*0.3);rot(h,'clavicle_r',0,0,-p.cl-br*0.3);
 const aFL=p.aF+p.aFL-sw*22,aFR=p.aF+p.aFR+sw*22;
 rot(h,'upperarm_l',aFL,0,p.aD);rot(h,'upperarm_r',aFR,0,-p.aD);
 rot(h,'lowerarm_l',0,-p.el,0);rot(h,'lowerarm_r',0,p.el,0);
 rot(h,'hand_l',0,-6,6);rot(h,'hand_r',0,6,-6);
 for(const f of['index','middle','ring','pinky'])for(const k of['01','02','03']){rot(h,`${f}_${k}_l`,0,0,p.fi*(k==='01'?0.6:1));rot(h,`${f}_${k}_r`,0,0,-p.fi*(k==='01'?0.6:1));}
 rot(h,'thumb_02_l',0,-p.fi*0.5,0);rot(h,'thumb_02_r',0,p.fi*0.5,0);
 const thL=p.th+p.thL+sw*24,thR=p.th+p.thR-sw*24;
 const knL=p.kn+p.knL+Math.max(0,sw)*36,knR=p.kn+p.knR+Math.max(0,-sw)*36;
 rot(h,'thigh_l',thL,0,0);rot(h,'thigh_r',thR,0,0);rot(h,'calf_l',-knL,0,0);rot(h,'calf_r',-knR,0,0);
 rot(h,'foot_l',-(thL-knL)*(1-p.air)-6*p.air,0,0);rot(h,'foot_r',-(thR-knR)*(1-p.air)-6*p.air,0,0);
 // picioarele rămân pe sticlă: corpul coboară exact cât îl scurtează genunchii
 const hgt=(t,k)=>L1*Math.cos(t*D2R)+L2*Math.cos((t-k)*D2R);
 const drop=(L1+L2)-Math.max(hgt(thL,knL),hgt(thR,knR));
 h.inner.position.y=-drop*(1-p.air);
 h.inner.position.z=-(L1*Math.sin(thL*D2R)*0.0);}
let me=makeHuman({num:opts.me?.num||'',name:'Tu',showLabel:false,hair:opts.me?.hair||'parted',hairColor:opts.me?.hairColor||'negru'});scene.add(me.root);
let partner=null;
function buildPartner(p){if(partner){scene.remove(partner.root);partner=null;}if(!p)return;
 partner=makeHuman({num:p.num||'',name:p.name||'Partener',ghost:true,hair:p.hair||'parted',hairColor:p.hairColor||'negru'});scene.add(partner.root);}
// ── Stare: vine DE LA SERVER. Aplicația nu cunoaște traseul; ține minte doar
// pe ce parte a sărit jucătorul în tura curentă (ca să-l așeze pe panoul lui).
let step=opts.state?.step||0,lives=opts.state?.lives??3,status=opts.state?.status||'active',busy=false,curPose=POSES.idle;
const myPath=[];
let partnerState=opts.partner?{step:opts.partner.step||0,status:opts.partner.status||'active'}:null;
buildPartner(opts.partner);
// Partenerul stă pe grinda centrală a rândului lui — NU pe un panou (nu dezvăluie partea).
function placePartner(){if(!partner||!partnerState)return;const z=partnerState.step===0?START_Z:rowZ(Math.min(ROWS,partnerState.step)-1);
 partner.root.position.set(0,-0.02,z+0.2);partner.root.rotation.y=0;partner.root.visible=partnerState.status!=='eliminated';applyPose(partner,POSES.balance);}
placePartner();
// ── Mesaje și efecte ──
const overlay=document.createElement('div');overlay.style.cssText='position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity .35s;text-align:center;padding:0 16px';
const mt=document.createElement('div');mt.style.cssText='font:700 clamp(28px,9vw,48px)/1.05 Oswald,"Arial Narrow",sans-serif;letter-spacing:1px;text-shadow:0 0 30px rgba(0,0,0,.9)';
const msub=document.createElement('div');msub.style.cssText='margin-top:8px;font-size:14px;color:#EAF6F2;text-shadow:0 1px 6px #000';overlay.append(mt,msub);
const fade=document.createElement('div');fade.style.cssText='position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .6s';
container.append(fade,overlay);const msg=overlay;
function showMsg(t,s,col,ms_=1600){mt.textContent=t;mt.style.color=col||'#fff';msub.textContent=s||'';msg.style.opacity=1;return new Promise(r=>setTimeout(()=>{msg.style.opacity=0;setTimeout(r,350);},ms_));}
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));

// ── Animații (timeline simplu cu promisiuni) ──
const anims=[];
function tween(dur,fn){return new Promise(res=>anims.push({t:0,dur,fn,res}));}
let camTarget=new T.Vector3(),camPos=new T.Vector3(),shake=0,fallCam=false,timeScale=1,craneFrom=null;
function standPos(){if(step===0)return new T.Vector3(0,0,START_Z);const sd=myPath[step-1];
 return sd===0||sd===1?panels[step-1][sd].g.position.clone().setY(0.04):new T.Vector3(0,0.02,rowZ(step-1)); // după refresh: pe grinda dintre panouri
}
function placeMe(){const p=standPos();me.root.position.copy(p);me.root.rotation.set(0,0,0);applyPose(me,POSES.idle);curPose=POSES.idle;}
placeMe();

function applyServerState(s){if(!s)return;step=s.step|0;lives=s.lives|0;status=s.status||'active';}
const BRIDGE_MSG=(e)=>({closed:'Termenul Podului a expirat.',stale:'Săritura era deja înregistrată.',network:'Fără conexiune. Încearcă din nou.',finished:'Jocul tău s-a încheiat.'}[e]||'Încearcă din nou.');
async function jump(side){
 if(busy||status!=='active'||step>=ROWS)return;busy=true;opts.onBusy?.(true);A.unlock();
 const row=step;const target=panels[row][side];
 // Cererea pleacă IMEDIAT; animația săriturii acoperă timpul de răspuns al serverului.
 const reply=Promise.resolve(opts.onPick(row,side)).catch(()=>({ok:false,error:'network'}));
 // 1. confirmare vizuală
 target.rim.material.uniforms.c.value.set(0xffd27a);target.rim.material.uniforms.a.value=1;A.step();
 const from=me.root.position.clone();const to=target.g.position.clone().setY(0.04);
 const yaw=Math.atan2(-(to.x-from.x),-(to.z-from.z));
 await tween(350,(t)=>{me.root.rotation.y=yaw*ease(t);});
 // 2. pregătire
 A.breath();await tween(750,(t)=>{curPose=mixPose(POSES.idle,POSES.crouch,ease(t));});
 // 3. săritura (arc)
 A.whoosh();await tween(900,(t)=>{const e=ease(t);me.root.position.lerpVectors(from,to,e);me.root.position.y=from.y+Math.sin(Math.PI*t)*1.1;curPose=mixPose(POSES.crouch,POSES.air,Math.min(1,t*2.2));if(t>0.6)curPose=mixPose(POSES.air,POSES.land,(t-.6)/.4);});
 // 4. aterizarea
 A.land();shake=0.06;target.g.position.y-=0.03;
 await tween(300,(t)=>{curPose=mixPose(POSES.land,POSES.balance,ease(t));target.g.position.y=-0.03*(1-t);});
 const res=await reply;
 if(!res||!res.ok){ // eroare (rețea, termen expirat, cerere veche): săritura nu contează, revii unde erai
  resetRim(target);await showMsg('ÎNCERCAREA NU A CONTAT',BRIDGE_MSG(res&&res.error),'#F5C451',1800);
  if(res&&res.state)applyServerState(res.state);placeMe();busy=false;opts.onBusy?.(false);opts.onState?.(res&&res.state);return;}
 const ok=res.result==='safe'||res.result==='won';
 // 5. suspans: sticla scârțâie, personajul își caută echilibrul
 A.creak(ok?1.2:0.9);
 await tween(ok?1300:700,(t)=>{curPose=POSES.balance;me.roll=Math.sin(t*18)*5*(1-t);target.g.rotation.z=Math.sin(t*40)*0.006;});
 target.g.rotation.z=0;me.roll=0;
 if(ok){
  // 6a. rezistă
  A.relief();await tween(800,(t)=>{curPose=mixPose(POSES.balance,POSES.relief,ease(t));});
  resetRim(target);
  myPath[row]=side;applyServerState(res.state);
  if(status==='won'){await walkToEnd();A.victory();await showMsg('POD TRAVERSAT','100 PCT','#F5C451',2600);busy=false;opts.onBusy?.(false);opts.onState?.(res.state);return;}
  await showMsg('AI SUPRAVIEȚUIT','',  '#2FBF9A',1100);
  await tween(500,(t)=>{curPose=mixPose(POSES.relief,POSES.idle,t);});
  busy=false;opts.onBusy?.(false);opts.onState?.(res.state);return;
 }
 // 6b. pare în regulă… apoi crapă
 target.crack.visible=true;buildCracks(target.ct,256+(Math.random()-.5)*60,256+(Math.random()-.5)*60);A.crack();
 await tween(900,(t)=>{drawCracks(target.ct,Math.pow(t,0.7));me.roll=Math.sin(t*30)*8;curPose=mixPose(POSES.balance,POSES.flail,t*0.4);});
 await wait(420);A.shatter();A.scream();shatter(target);shake=0.22;
 // încetinitor dramatic la spargere, iar camera urcă deasupra golului
 timeScale=0.3;craneFrom=target.g.position.clone();setTimeout(()=>{timeScale=0.6;},1300);setTimeout(()=>{timeScale=1;},2600);
 // 7. căderea, urmărită de cameră
 fallCam=true;const fallStart=me.root.position.clone();let vy=0;
 await tween(2600,(t)=>{me.root.position.y=fallStart.y+(-4.9*Math.pow(t*2.2,2));me.root.rotation.x=-t*1.6;me.root.rotation.z=Math.sin(t*5)*0.4;curPose=mixPose(POSES.flail,POSES.air,Math.min(1,t*1.5)*0.3);});
 fade.style.opacity=1;await wait(700);
 fallCam=false;craneFrom=null;timeScale=1;myPath.length=0;applyServerState(res.state);
 if(status==='eliminated'){fade.style.opacity=0;placeMe();resetPanelsVisual();camPos.set(0,2.55,START_Z+4.6);camTarget.set(0,0.1,rowZ(0)-0.6);await showMsg('ELIMINAT','0 PCT','#FF4053',2600);busy=false;opts.onBusy?.(false);opts.onState?.(res.state);return;}
 await showMsg(lives===1?'ULTIMA VIAȚĂ':'AI PIERDUT O VIAȚĂ',`Mai ai ${lives} ${lives===1?'viață':'vieți'}. Înapoi la început.`,'#FF4053',2000);
 placeMe();resetPanelsVisual();camPos.set(0,2.55,START_Z+4.6);camTarget.set(0,0.1,rowZ(0)-0.6);fade.style.opacity=0;busy=false;opts.onBusy?.(false);opts.onState?.(res.state);
}
// După o cădere, TOATE cele 18 panouri revin exact ca la început: fără găuri,
// fără fisuri, fără culori diferite. Traseul secret NU se schimbă.
function resetRim(p){p.rim.material.uniforms.c.value.set(0x9ff5df);p.rim.material.uniforms.a.value=0.35;}
function resetPanelsVisual(){
 panels.forEach(r=>r.forEach(p=>{p.broken=false;p.gl.visible=true;p.rim.visible=true;resetRim(p);
  p.crack.visible=false;p.ct.lines=null;p.ct.g.clearRect(0,0,512,512);p.ct.t.needsUpdate=true;
  p.g.position.y=0;p.g.rotation.set(0,0,0);}));
 shards.splice(0).forEach(s=>{scene.remove(s.m);s.m.geometry.dispose();});
 glitter.splice(0).forEach(g=>{scene.remove(g.pts);g.pts.geometry.dispose();});
 me.root.rotation.set(0,0,0);me.roll=0;
}
let walkPhase=0;
async function walkToEnd(){const from=me.root.position.clone();const to=new T.Vector3(0,0,rowZ(ROWS)-2.4);await tween(1800,(t)=>{me.root.position.lerpVectors(from,to,t);curPose=POSES.idle;walkPhase=t*Math.PI*6;});walkPhase=0;curPose=POSES.idle;}

// ── Atingerea directă a panourilor ──
const ray=new T.Raycaster(),ndc=new T.Vector2();let downAt=null;
const onDown=(e)=>{downAt={x:e.clientX,y:e.clientY,t:performance.now()};};canvas.addEventListener('pointerdown',onDown);
const onUp=(e)=>{if(!downAt)return;const d=Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y);const dt=performance.now()-downAt.t;downAt=null;if(d>18||dt>700)return;
 if(busy||status!=='active'||step>=ROWS)return;const rc=canvas.getBoundingClientRect();ndc.set((e.clientX-rc.left)/rc.width*2-1,-((e.clientY-rc.top)/rc.height)*2+1);ray.setFromCamera(ndc,camera);
 const cand=[panels[step][0].gl,panels[step][1].gl];const hit=ray.intersectObjects(cand,false)[0];
 // țintă generoasă: dacă nu atinge exact sticla, alege panoul de pe partea atinsă a ecranului
 let side=hit?hit.object.userData.side:null;
 if(side===null){const pL=panels[step][0].g.position.clone().project(camera),pR=panels[step][1].g.position.clone().project(camera);if(Math.abs(ndc.y-(pL.y+pR.y)/2)<0.35)side=Math.abs(ndc.x-pL.x)<Math.abs(ndc.x-pR.x)?0:1;}
 if(side!==null)jump(side);};canvas.addEventListener('pointerup',onUp);

// ── Cameră, buclă, panouri pulsând ──
function resize(){const w=container.clientWidth||1,h=container.clientHeight||1;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<h?66:52;camera.updateProjectionMatrix();}
const ro=new ResizeObserver(resize);ro.observe(container);resize();
const clock=new T.Clock();let running=true;
let raf=0;const onVis=()=>{const v=document.visibilityState==='visible';if(v&&!running){running=true;clock.getDelta();loop();}if(!v){running=false;cancelAnimationFrame(raf);}};document.addEventListener('visibilitychange',onVis);
function frame(dt){
 const now=performance.now()/1000;
 const sdt=dt*timeScale;
 for(let i=anims.length-1;i>=0;i--){const a=anims[i];a.t+=sdt*1000;const k=Math.min(1,a.t/a.dur);a.fn(k);if(k>=1){anims.splice(i,1);a.res();}}
 applyPose(me,curPose,now*2,walkPhase);
 if(partner){partner.roll=Math.sin(now*1.3)*4;applyPose(partner,POSES.balance,now*1.5);}
 // panourile rândului curent pulsează discret (doar când poți alege)
 if(status==='active'&&!busy&&panels[step])for(const p of panels[step]){p.rim.material.uniforms.a.value=0.45+Math.sin(now*3)*0.25;}
 // cioburi
 for(let i=shards.length-1;i>=0;i--){const s=shards[i];s.v.y-=9.8*sdt;s.m.position.addScaledVector(s.v,sdt);s.m.rotation.x+=s.w.x*sdt;s.m.rotation.y+=s.w.y*sdt;s.m.rotation.z+=s.w.z*sdt;s.life-=sdt;if(s.life<=0||s.m.position.y<-40){scene.remove(s.m);s.m.geometry.dispose();shards.splice(i,1);}}
 for(let i=glitter.length-1;i>=0;i--){const g=glitter[i];const pa=g.pts.geometry.attributes.position.array;g.vel.forEach((v,k)=>{v.y-=6*dt;pa[k*3]+=v.x*dt;pa[k*3+1]+=v.y*dt;pa[k*3+2]+=v.z*dt;});g.pts.geometry.attributes.position.needsUpdate=true;g.life-=dt;g.pts.material.opacity=Math.max(0,g.life/2.2);if(g.life<=0){scene.remove(g.pts);g.pts.geometry.dispose();glitter.splice(i,1);}}
 // camera: în spate și jos, privind spre rândul următor
 const p=me.root.position;
 if(fallCam&&craneFrom){ // cadru de macara: sus, deasupra găurii din pod, privind în gol după personaj
  camTarget.lerp(new T.Vector3(p.x,p.y,p.z),0.08);camPos.lerp(new T.Vector3(craneFrom.x*0.6+1.2,7.5,craneFrom.z+2.8),0.03);}
 else if(fallCam){camTarget.lerp(new T.Vector3(p.x,p.y,p.z),0.12);camPos.lerp(new T.Vector3(p.x+0.4,1.8,p.z+2.2),0.06);}
 else{const nextZ=status==='active'&&step<ROWS?rowZ(step):p.z-3;camTarget.lerp(new T.Vector3(0,0.1,nextZ-0.6),0.06);camPos.lerp(new T.Vector3(p.x*0.35,2.55,p.z+4.6),0.05);}
 camera.position.copy(camPos);if(shake>0){camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake;shake=Math.max(0,shake-dt*0.5);}
 camera.lookAt(camTarget);
 key.position.set(p.x,16,p.z+4);key.target.position.set(p.x,0,p.z-2);
}
camPos.set(0,2.55,START_Z+4.6);camTarget.set(0,0.1,rowZ(0)-0.6);
function loop(){if(!running)return;const dt=Math.min(clock.getDelta(),1/30);frame(dt);renderer.render(scene,camera);raf=requestAnimationFrame(loop);}
loop();

// ══ SUNET — ÎNREGISTRĂRI REALE (CC0): Meta Open Sound + Kenney Impact Sounds ══
// Sticla, pașii pe metal, ambianța halei, șuierăturile, efortul și țipătul sunt
// înregistrări reale. Web Audio doar le mixează (volum, ecoul halei, ordinea).
const A=(()=>{let ctx=null,bus=null,on=false,buf={},loading=null,ambNodes=[],music=null,sched=null,nextBeat=0,beat=0,level=0;
 const N=(n)=>440*Math.pow(2,(n-69)/12);
 const env=(t,a,p,d)=>{const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(p,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+d);return g;};
 let nb=null;const noise=()=>{if(nb)return nb;nb=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return nb;};
 function recorder(t,f,dur,vol){const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.04);g.gain.setValueAtTime(vol,t+Math.max(0.05,dur-0.08));g.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.06);
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3000;lp.connect(g);g.connect(music);
  const o=ctx.createOscillator();o.type='triangle';o.frequency.value=f;const o2=ctx.createOscillator();o2.frequency.value=f*2;const g2=ctx.createGain();g2.gain.value=0.15;
  const vib=ctx.createOscillator();vib.frequency.value=5;const vg=ctx.createGain();vg.gain.setValueAtTime(0,t);vg.gain.linearRampToValueAtTime(f*0.006,t+0.25);vib.connect(vg);vg.connect(o.frequency);
  o.connect(lp);o2.connect(g2);g2.connect(lp);[o,o2,vib].forEach(x=>{x.start(t);x.stop(t+dur+0.1);});}
 function snare(t,vol){const s=ctx.createBufferSource();s.buffer=noise();const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=1500;const g=env(t,0.002,vol,0.12);s.connect(hp);hp.connect(g);g.connect(music);s.start(t);s.stop(t+0.2);}
 function tick(t,vol,hi){const o=ctx.createOscillator();o.type='square';o.frequency.value=hi?2300:1700;const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=hi?2300:1700;bp.Q.value=8;const g=env(t,0.001,vol,0.035);o.connect(bp);bp.connect(g);g.connect(music);o.start(t);o.stop(t+0.06);}
 function bass(t,f,vol){const o=ctx.createOscillator();o.type='triangle';o.frequency.value=f;const g=env(t,0.01,vol,0.9);o.connect(g);g.connect(music);o.start(t);o.stop(t+1);}
 // motiv original, în la minor, rar și neliniștitor (8 bătăi pe frază)
 const MOTIF=[[69,2],[72,1],[71,1],[69,2],[64,2],[0,8],[69,2],[72,1],[74,1],[76,2],[74,1],[72,1],[71,4],[0,4],[67,2],[69,1],[67,1],[64,2],[62,2],[64,6],[0,10]];
 let mi=0,mLeft=0;
 function schedule(){if(!music)return;const spb=60/(76+level*34);
  while(nextBeat<ctx.currentTime+0.4){const t=nextBeat;
   tick(t,0.05+level*0.07,beat%4===0);                          // ceasul: mereu prezent, mai tare la suspans
   if(beat%8===0)bass(t,N(45),0.16);if(beat%8===4)bass(t,N(40),0.13);
   if(level>0.5){snare(t,0.06+((beat%4)/4)*0.08);if(beat%2===1)snare(t+spb/2,0.05);}  // toba crește în suspans
   else if(beat%16===15){for(let k=0;k<6;k++)snare(t+k*spb/6,0.03+k*0.015);}
   if(mLeft<=0){const [n,l]=MOTIF[mi%MOTIF.length];mi++;mLeft=l;if(n&&level<0.5)recorder(t,N(n),l*spb*0.9,0.07);}
   mLeft--;beat++;nextBeat+=spb;}}
 function init(){if(ctx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;ctx=new AC();
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-10;comp.ratio.value=8;comp.knee.value=4;comp.attack.value=0.002;comp.release.value=0.2;
  const out=ctx.createGain();out.gain.value=0.95;comp.connect(out);out.connect(ctx.destination);
  bus=ctx.createGain();const dry=ctx.createGain(),wet=ctx.createGain();dry.gain.value=1;wet.gain.value=0.28;
  const rev=ctx.createConvolver();const len=ctx.sampleRate*2.6,b=ctx.createBuffer(2,len,ctx.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.8);}rev.buffer=b;
  bus.connect(dry);dry.connect(comp);bus.connect(rev);rev.connect(wet);wet.connect(comp);
  const toAB=(url)=>{const b=atob(url.split(',')[1]),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u.buffer;};
  const dec=(ab)=>new Promise((res,rej)=>{try{const p=ctx.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej);}catch(e){rej(e);}});
  loading=Promise.all(Object.entries(SFX).map(async([k,url])=>{try{buf[k]=await dec(toAB(url));}catch(e){console.warn('sunet',k,e);}}));}
 function play(name,{vol=1,rate=1,delay=0,loop=false,dest=null}={}){if(!on||!ctx||!buf[name])return null;const s=ctx.createBufferSource();s.buffer=buf[name];s.playbackRate.value=rate;s.loop=loop;
  const g=ctx.createGain();g.gain.value=vol;s.connect(g);g.connect(dest||bus);s.start(ctx.currentTime+delay);return {s,g};}
 const pick=(arr)=>arr[Math.floor(Math.random()*arr.length)];
 function ambOn(){if(ambNodes.length)return;const a=play('AMBInd_RoomToneMachineRoom_LOOP_01',{vol:0.0001,loop:true});const d=play('DSGNDron_DroneCreepy_OS_01',{vol:0.0001,loop:true,rate:0.85});
  [a,d].forEach((n,i)=>{if(n){n.g.gain.setTargetAtTime(i?0.12:0.45,ctx.currentTime,1.2);ambNodes.push(n);}});}
 function ambOff(){ambNodes.splice(0).forEach(n=>{n.g.gain.setTargetAtTime(0.0001,ctx.currentTime,0.3);setTimeout(()=>{try{n.s.stop();}catch(e){}},1500);});}
 return {
  unlock(){init();if(ctx&&ctx.state==='suspended')ctx.resume();},
  setOn(v){init();on=!!v;if(on){this.unlock();(loading||Promise.resolve()).then(()=>{if(on)ambOn();});}else{ambOff();this.musicOff();}return on;},
  step(){play(pick(['FEETHmn_ShoeMetalWalk_OS_01','FEETHmn_ShoeMetalWalk_OS_02']),{vol:0.7});},
  breath(){play('FEETHmn_ShoeMetalWalk_OS_02',{vol:0.35,rate:0.9});},
  whoosh(){play('VOXEfrt_Male01Effort_OS_01',{vol:0.55});play('WHSH_WhooshMedium_OS_01',{vol:0.6,delay:0.05});},
  land(){play('impact_glass_heavy_000',{vol:0.9});play('FEETHmn_ShoeMetalLand_OS_01',{vol:0.35});},
  // suspansul: sticla „lucrează” sub greutate — mici impacturi reale de sticlă + scârțâitul structurii
  creak(len=1){play('WOODFric_CreaksCreepy_OS_01',{vol:0.45,rate:1.25});
   const n=Math.round(3+len*3);for(let i=0;i<n;i++)play(pick(['impact_glass_light_000','impact_glass_light_001','impact_glass_light_002']),{vol:0.25+Math.random()*0.2,rate:1.3+Math.random()*0.4,delay:0.15+i*(len/n)});},
  relief(){play('impact_glass_light_001',{vol:0.18,rate:0.8});},
  // fisurile: pocnituri reale de sticlă, tot mai dese
  crack(){for(let i=0;i<9;i++)play(pick(['impact_glass_medium_000','impact_glass_medium_001','impact_glass_light_002']),{vol:0.35+i*0.05,rate:1.6+Math.random()*0.5,delay:Math.pow(i/9,1.5)*0.8});},
  // spargerea: geam spart + sticlă spartă + impact greu, stratificate, după o clipă de liniște
  shatter(){play('GLASBrk_WindowPaneSmallBreak_OS_01',{vol:1.0,rate:0.82});play('GLASBrk_GlassBottleBreak_OS_01',{vol:0.75,rate:0.92,delay:0.03});
   play('impact_glass_heavy_002',{vol:1.0,rate:0.6});play('GLASBrk_WindowPaneSmallBreak_OS_01',{vol:0.55,rate:1.15,delay:0.12});},
  // țipătul pornește la 0,12 s după primul trosnet — fără liniște între spargere și cădere
  scream(){play('VOXScrm_MaleScream_OS_01',{vol:0.85,delay:0.12});play('WHSH_WhooshMedium_OS_01',{vol:0.7,rate:0.55,delay:0.35});play('WHSH_WhooshMedium_OS_01',{vol:0.5,rate:0.45,delay:1.1});},
  fall(){},
  // ── MUZICA (originală, în stilul serialului: fluier de școală, tobă mică, ceas care ticăie) ──
  musicOn(){if(!ctx||music)return;music=ctx.createGain();music.gain.value=0.0001;music.connect(bus);music.gain.setTargetAtTime(0.55,ctx.currentTime,1.5);
   nextBeat=ctx.currentTime+0.2;beat=0;sched=setInterval(schedule,90);},
  musicOff(){if(!music)return;clearInterval(sched);const m=music;music=null;m.gain.setTargetAtTime(0.0001,ctx.currentTime,0.4);setTimeout(()=>m.disconnect(),2000);},
  // 0 = calm, 1 = suspans (săritură în curs): ceasul se aude mai tare, toba crește
  intensity(v){level=v;},
  cash(){play('impact_metal_light_000',{vol:0.8});play('impact_glass_light_000',{vol:0.4,delay:0.08});},
  victory(){play('impact_metal_light_000',{vol:0.9});play('impact_glass_heavy_000',{vol:0.4,rate:1.5,delay:0.1});},
 };})();
// ── API pentru ecranul React ──
return {
  setPartner(p){partnerState=p?{step:p.step||0,status:p.status||'active'}:null;if(p&&!partner)buildPartner(p);if(!p&&partner){scene.remove(partner.root);partner=null;}placePartner();},
  setState(s){if(busy||!s)return;const prevStep=step;applyServerState(s);if(step!==prevStep){if(step<prevStep)myPath.length=0;placeMe();}},
  setSound(v){A.setOn(v);},
  cashFx(){A.cash();},
  isBusy(){return busy;},
  dispose(){running=false;cancelAnimationFrame(raf);ro.disconnect();document.removeEventListener('visibilitychange',onVis);
    canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointerup',onUp);A.setOn(false);
    scene.traverse((o)=>{o.geometry?.dispose?.();const m=o.material;(Array.isArray(m)?m:[m]).forEach((x)=>{x?.map?.dispose?.();x?.dispose?.();});});
    renderer.dispose();[canvas,fade,overlay].forEach((el)=>{if(el.parentNode===container)container.removeChild(el);});},
};
}

export default function GlassBridge3D({ assets, me, partner, state, onPick, onState, onBusy, soundOn, height = 520 }) {
  const ref = useRef(null);
  const api = useRef(null);
  const cb = useRef({});
  cb.current = { onPick, onState, onBusy };
  useEffect(() => {
    if (!ref.current || !assets) return undefined;
    const s = createBridgeScene(ref.current, assets, {
      me, partner, state,
      onPick: (row, side) => cb.current.onPick?.(row, side),
      onState: (st) => cb.current.onState?.(st),
      onBusy: (b) => cb.current.onBusy?.(b),
    });
    api.current = s;
    return () => { s?.dispose(); api.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, me?.num, me?.hair, me?.hairColor]);
  useEffect(() => { api.current?.setPartner(partner || null); }, [partner?.step, partner?.status, partner?.num]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.current?.setState(state); }, [state?.step, state?.lives, state?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.current?.setSound(!!soundOn); }, [soundOn]);
  return <div ref={ref} style={{ position: "relative", width: "100%", height, overflow: "hidden", borderRadius: 14, background: "#03080a", touchAction: "none" }} />;
}
