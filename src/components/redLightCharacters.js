import * as THREE from "three";

// ══════════════════════════════════════════════════════════════════
// 🚦 Personajele pentru RED LIGHT SHOW.
// COPIE ADAPTATĂ a constructorului de personaje din GlassBridge3D.jsx
// (Podul de Sticlă rămâne NEATINS): Quaternius „Universal Base Characters”
// (CC0), schelet de 65 de oase, treninguri pe rolurile Sezonului 3, numărul
// pe spate, păr scurt / chel. Resursele vin din /public/bridge/*.json
// (aceleași fișiere, deja în proiect).
// ══════════════════════════════════════════════════════════════════
export function createCharacterKit(assets) {
const T = THREE;
function numberTex(num,name,role){const c=document.createElement('canvas');c.width=256;c.height=256;const g=c.getContext('2d');
 const r=ROLES[role]||ROLES.player;g.fillStyle='#'+new T.Color(role&&role!=='player'?r.suit:0x15624b).getHexString();g.fillRect(0,0,256,256);g.fillStyle='#fff';g.font='800 120px Oswald,Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(num,128,138);
 const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;return t;}

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
 guard:{suit:0xb0163c,dark:0x7e0f2b,stripe:0xb0163c,shoe:0x151515,hood:null},      // paznic: salopetă roșie, glugă roșie, mască neagră pe față
 vip:{suit:0x1a1a1e,dark:0xb8902e,stripe:0x1a1a1e,shoe:0x0d0d0d,hood:null},             // sponsor: costum închis, accente aurii
 vip2:{suit:0x4a1f17,dark:0x8c1d24,stripe:0x4a1f17,shoe:0x0d0d0d,hood:null},           // 002: costum maro-vișiniu
 vip3:{suit:0x14203f,dark:0xc9a227,stripe:0x14203f,shoe:0x0d0d0d,hood:null},           // 003: bleumarin cu auriu
 vip4:{suit:0x3a1450,dark:0xc9a227,stripe:0x3a1450,shoe:0x0d0d0d,hood:null},           // 004: violet cu auriu
 boss:{suit:0x0c0c0e,dark:0x1c1c20,stripe:0x0c0c0e,shoe:0x080808,hood:null},        // șeful: negru complet, glugă neagră
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
// ── Cojile capului (păr periuță, glugă, mască) — din triunghiurile capului, în poziția de repaus ──
const HEAD_IDX=HUMAN.names.indexOf('Head');
const HEAD_M=(()=>{const P=HD.pos;let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;const cnt=P.length/3;
 for(let i=0;i<cnt;i++){if(HUMAN.names[HD.si[i*4]]!=='Head')continue;const x=P[i*3],y=P[i*3+1],z=P[i*3+2];x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);z0=Math.min(z0,z);z1=Math.max(z1,z);}
 return {x0,x1,y0,y1,z0,z1,cx:(x0+x1)/2,cz:(z0+z1)/2,hx:(x1-x0)/2,hz:(z1-z0)/2,h:y1-y0,zFront:z0,faceY:y0+(y1-y0)*0.58};})();
// fața privește spre -z (numărul e pe spate, la +z)
function headRegion(kind,x,y,z){const M=HEAD_M;const u=(y-M.y0)/M.h,fz=(z-M.cz)/M.hz,ax=Math.abs(x-M.cx)/M.hx;
 const isFace=fz<-0.25&&u>0.16&&u<0.8&&ax<0.66;
 if(kind==='face')return isFace;
 if(kind==='hood')return !isFace&&u>0.1;
 // păr: linia părului mai sus în față, mai jos la ceafă; urechile rămân libere
 const thr=0.62-0.22*fz;if(ax>0.8&&u<0.72&&fz<0.35)return false;return u>thr;}
const SHELL_CACHE={};
function headShell(kind,off){const key=kind+off;if(SHELL_CACHE[key])return SHELL_CACHE[key];
 const base=new T.BufferGeometry();base.setAttribute('position',new T.BufferAttribute(new Float32Array(HD.pos),3));base.setIndex(new T.BufferAttribute(HD.idx,1));base.computeVertexNormals();
 const P=base.attributes.position.array,N=base.attributes.normal.array,I=HD.idx;const pos=[];
 for(let t=0;t<I.length;t+=3){const a=I[t],b=I[t+1],c=I[t+2];let ok=true;
  for(const v of [a,b,c]){const bn=HUMAN.names[HD.si[v*4]];
   // gluga acoperă și gâtul (ca o cagulă); părul și masca doar capul
   const inBone=bn==='Head'||(kind==='hood'&&bn==='neck_01'&&P[v*3+1]>1.52);
   if(!inBone||!(bn==='neck_01'||headRegion(kind,P[v*3],P[v*3+1],P[v*3+2]))){ok=false;break;}}
  if(!ok)continue;for(const v of [a,b,c])pos.push(P[v*3]+N[v*3]*off,P[v*3+1]+N[v*3+1]*off,P[v*3+2]+N[v*3+2]*off);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();
 g.applyMatrix4(new T.Matrix4().fromArray(HUMAN.inv,HEAD_IDX*16)); // din poziția de repaus în spațiul osului capului
 SHELL_CACHE[key]=g;return g;}
function symbolTex(k){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.strokeStyle='#f4f4f4';g.lineWidth=12;g.beginPath();
 if(k===0)g.arc(64,64,40,0,Math.PI*2);else if(k===1){g.moveTo(64,20);g.lineTo(108,100);g.lineTo(20,100);g.closePath();}else g.rect(24,24,80,80);g.stroke();
 const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;return t;}
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
 if(B.pelvis&&B.spine_01){B.pelvis.scale.set(0.9,1,0.94);B.spine_01.scale.set(1/0.9,1,1/0.94);}
 if(B.spine_03&&B.neck_01){B.spine_03.scale.set(1.08,1,1.05);B.neck_01.scale.set(1/1.08,1,1/1.05);}
 const hairMat=new T.MeshStandardMaterial({color:HAIR_COLORS[hairColor]||0x120d0a,roughness:0.9,side:T.DoubleSide,transparent:ghost,opacity:op,depthWrite:!ghost});
 // stratul de bază (scalpul tuns scurt) e mereu pus, ca să nu se vadă pielea prin coafură
 // PĂR TUNS PERIUȚĂ: o „coajă” luată chiar din forma capului, umflată cu 4 mm — urmează perfect craniul,
 // nu are șuvițe și nu poate arăta a păr lung. Chel = fără coajă.
 const hairMesh=new T.Group();
 if(hair!=='bald'){const hm=new T.Mesh(headShell('hair',0.0045),new T.MeshLambertMaterial({color:new T.Color(HAIR_COLORS[hairColor]||0x120d0a).multiplyScalar(0.35),side:T.DoubleSide,transparent:ghost,opacity:op}));hairMesh.add(hm);}
 B.Head.add(hairMesh);
 // glugă (paznic, șef): calotă care acoperă capul
 // GLUGĂ (gardian, Leader): coajă de material pe tot capul, mai puțin fața; pe față, masca (neagră) cu simbol.
 const hoodC=(ROLES[role]||{}).hood;let hood=null;if(hoodC!=null){
  hood=new T.Mesh(headShell('hood',0.014),new T.MeshLambertMaterial({color:new T.Color(hoodC).multiplyScalar(role==='boss'?0.4:0.75),side:T.DoubleSide,transparent:ghost,opacity:op}));B.Head.add(hood);
  const mask=new T.Mesh(headShell('face',0.008),new T.MeshStandardMaterial({color:0x060606,roughness:0.28,metalness:0.25,side:T.DoubleSide,transparent:ghost,opacity:op}));B.Head.add(mask);
  if(role==='guard'){const sym=new T.Mesh(new T.CircleGeometry(0.03,24),new T.MeshBasicMaterial({map:symbolTex((num||'').length%3),transparent:true,toneMapped:false}));
   sym.position.copy(B.Head.worldToLocal(new T.Vector3(0,HEAD_M.faceY,HEAD_M.zFront-0.012)));const hq=new T.Quaternion();B.Head.getWorldQuaternion(hq);sym.quaternion.copy(hq.invert());sym.rotateY(Math.PI);B.Head.add(sym);}
  hairMesh.visible=false;}
 mesh.updateMatrixWorld(true);
 // numărul pe spate, lipit de vertebra de sus
 const nt=numberTex(num,null,role);const deco=new T.Mesh(new T.PlaneGeometry(0.24,0.24),new T.MeshStandardMaterial({map:nt,roughness:.85,transparent:true,opacity:op,polygonOffset:true,polygonOffsetFactor:-2}));
 let maxZ=0;const P=BASE_GEO.attributes.position.array;for(let i=0;i<P.length;i+=3){if(Math.abs(P[i])<0.07&&P[i+1]>1.25&&P[i+1]<1.36)maxZ=Math.max(maxZ,P[i+2]);}
 if(!num)deco.visible=false;
 const sp=B.spine_03;const wq=new T.Quaternion();sp.getWorldQuaternion(wq);deco.position.copy(sp.worldToLocal(new T.Vector3(0,1.3,maxZ+0.006)));deco.quaternion.copy(wq.invert());sp.add(deco);
 const restL={},restW={};bones.forEach(b=>{restL[b.name]=b.quaternion.clone();const q=new T.Quaternion();b.getWorldQuaternion(q);restW[b.name]=q;});
 // numărul pe spate: la TOȚI (Leader, Pretenders, Guards, Nobodies)
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
 cheer:PZ({sp:-6,hd:-14,aD:-58,aF:18,el:16,th:2,kn:4,fi:6}),
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

// ── Poze suplimentare pentru Lumină roșie (aceeași convenție de grade) ──
POSES.walk = PZ({ sp: 6, hd: 0, aD: 78, aF: 4, el: 22, kn: 6, fi: 18 });
POSES.sprint = PZ({ sp: 22, hd: -8, aD: 70, aF: 10, el: 70, kn: 14, fi: 30 });
POSES.freeze = PZ({ sp: 4, hd: 4, aD: 62, aF: 8, el: 18, th: 4, kn: 8, fi: 26, thL: 18, knL: 10 });
POSES.flinch = PZ({ sp: -8, hd: -16, aD: 30, aF: 30, el: 70, th: 6, kn: 12, fi: 40 });
POSES.kneel = PZ({ sp: 36, hd: 34, aD: 84, aF: 12, el: 18, th: 92, kn: 150, fi: 14 });
POSES.safe = PZ({ sp: 2, hd: -4, aD: 70, aF: 30, el: 100, kn: 4, fi: 30, cl: -4 });
return { makeHuman, applyPose, POSES, mixPose, ease, D2R };
}
