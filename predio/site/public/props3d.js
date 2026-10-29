import * as THREE from 'three';

// Todos os objetos têm origem no chão e usam apenas primitivas do importmap.
const escuro=0x182332,metal=0x748596,claro=0xeef1fa;
function peca(g,geo,cor,x,y,z,emissao=false){
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:cor,roughness:.65,flatShading:true,...(emissao?{emissive:cor,emissiveIntensity:.8}:{})}));
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
}
const caixa=(g,c,x,y,z,w,h,d,e)=>peca(g,new THREE.BoxGeometry(w,h,d),c,x,y,z,e);
const cilindro=(g,c,x,y,z,r,h)=>peca(g,new THREE.CylinderGeometry(r,r,h,12),c,x,y,z);
const bola=(g,c,x,y,z,r)=>peca(g,new THREE.SphereGeometry(r,12,8),c,x,y,z);
function tripe(g,h=1){cilindro(g,metal,0,h/2,0,.035,h);for(const a of [0,2.094,4.189]){const perna=caixa(g,metal,Math.cos(a)*.18,.2,Math.sin(a)*.18,.035,.5,.035);perna.rotation.z=Math.sin(a)*.6;perna.rotation.x=Math.cos(a)*.6;}}

export function claquete(c=0xffbb66){
  const g=new THREE.Group();caixa(g,escuro,0,.45,0,1.2,.8,.12);const topo=caixa(g,claro,0,.96,0,1.3,.17,.15);topo.rotation.z=.13;
  for(let x=-.5;x<.6;x+=.25){const faixa=caixa(g,escuro,x,.96,.082,.13,.17,.015);faixa.rotation.z=-.35;}
  for(const y of [.3,.47,.64])caixa(g,c,0,y,.07,.85,.025,.015);return g;
}
export function refletor(c=0xffd9a0){
  const g=new THREE.Group();tripe(g);const luz=cilindro(g,escuro,0,1.16,0,.27,.4);luz.rotation.x=Math.PI/2;
  const lente=cilindro(g,c,0,1.16,.21,.22,.025);lente.rotation.x=Math.PI/2;lente.material.emissive.set(c);return g;
}
export function camera(c=0x8ce4ef){
  const g=new THREE.Group();tripe(g);caixa(g,escuro,0,1.18,0,.65,.4,.4);const lente=cilindro(g,metal,0,1.18,.3,.16,.3);lente.rotation.x=Math.PI/2;
  caixa(g,c,.34,1.2,0,.025,.24,.32,true);return g;
}
export function sofa(c=0x956dba){
  const g=new THREE.Group();caixa(g,c,0,.38,0,1.8,.4,.8);caixa(g,c,0,.8,-.34,1.8,.65,.18);
  for(const x of [-.82,.82]){caixa(g,c,x,.62,0,.18,.45,.85);for(const z of [-.27,.27])caixa(g,metal,x,.1,z,.07,.2,.07);}return g;
}
export function arcade(c=0x956dff){
  const g=new THREE.Group();caixa(g,escuro,0,.8,0,.8,1.6,.65);caixa(g,c,0,1.67,0,.88,.22,.7);caixa(g,c,0,1.15,.334,.6,.48,.025,true);
  caixa(g,metal,0,.81,.39,.8,.1,.35);cilindro(g,c,-.2,.92,.41,.045,.18);for(const x of [.1,.24])bola(g,c,x,.88,.44,.045);return g;
}
export function controle(c=0x8ce4ef){
  const g=new THREE.Group();caixa(g,escuro,0,.3,0,.9,.3,.5);for(const x of [-.43,.43])bola(g,escuro,x,.24,.14,.25);
  caixa(g,c,-.25,.47,0,.25,.025,.07);caixa(g,c,-.25,.47,0,.07,.025,.25);for(const x of [.17,.32])bola(g,c,x,.47,0,.055);return g;
}
export function pufe(c=0xffb020){const g=new THREE.Group();const b=bola(g,c,0,.35,0,.55);b.scale.set(1,.65,1);return g;}
export function neon(c=0x25f4ee){
  const g=new THREE.Group();caixa(g,escuro,0,.08,0,1.2,.16,.45);for(const x of [-.5,.5])cilindro(g,metal,x,.65,0,.025,1.2);
  peca(g,new THREE.TorusGeometry(.43,.045,6,24),c,0,1,0,true);caixa(g,c,0,1,0,.55,.05,.05,true);return g;
}
export function servidor(c=0x25f4ee){
  const g=new THREE.Group();caixa(g,escuro,0,.9,0,.7,1.8,.65);for(let y=.25;y<1.8;y+=.3){caixa(g,metal,0,y,.34,.58,.22,.025);caixa(g,c,.2,y,.36,.045,.045,.02,true);}return g;
}
export function quadro_branco(c=0x748596){
  const g=new THREE.Group();for(const x of [-.6,.6]){cilindro(g,metal,x,.7,0,.025,1.4);caixa(g,metal,x,.04,0,.08,.08,.6);}
  caixa(g,c,0,1.3,0,1.6,.95,.08);caixa(g,claro,0,1.3,.05,1.48,.83,.02);for(const y of [1.15,1.35,1.55])caixa(g,c,-.15,y,.07,.8,.025,.015);return g;
}
export function monitor_duplo(c=0x8ce4ef){
  const g=new THREE.Group();caixa(g,metal,0,.04,0,.7,.08,.45);cilindro(g,metal,0,.4,0,.04,.8);
  for(const x of [-.46,.46]){caixa(g,escuro,x,.8,0,.88,.58,.08);caixa(g,c,x,.8,.05,.78,.48,.02,true);}return g;
}
export function planta(){
  const g=new THREE.Group();peca(g,new THREE.CylinderGeometry(.3,.22,.45,10),0xbb8368,0,.225,0);cilindro(g,0x77654a,0,.7,0,.04,1);
  for(const [x,y,z] of [[0,1.3,0],[-.23,1,.1],[.24,1.1,-.1]]){const folha=bola(g,0x548866,x,y,z,.3);folha.scale.y=1.4;}return g;
}
export function estante(c=0xad8b64){
  const g=new THREE.Group();for(const x of [-.6,.6])caixa(g,c,x,.9,0,.08,1.8,.45);
  for(const y of [.1,.65,1.2,1.75]){caixa(g,c,0,y,0,1.3,.08,.45);if(y<1.7)for(let i=0;i<5;i++)caixa(g,[0x8bc6ff,0xbb91dc,0xe9aa73][i%3],-.42+i*.19,y+.23,0,.12,.38,.28);}return g;
}
export function trofeu(c=0xe8bc53){
  const g=new THREE.Group();caixa(g,escuro,0,.09,0,.65,.18,.5);cilindro(g,c,0,.45,0,.07,.6);peca(g,new THREE.CylinderGeometry(.3,.12,.45,12),c,0,.9,0);
  for(const x of [-.3,.3]){const alca=peca(g,new THREE.TorusGeometry(.2,.035,6,16),c,x,.85,0);alca.scale.x=.7;}return g;
}
export function mesa_pingpong(c=0x379885){
  const g=new THREE.Group();caixa(g,c,0,.8,0,2.4,.1,1.4);for(const x of [-.9,.9])for(const z of [-.5,.5])caixa(g,metal,x,.4,z,.06,.8,.06);
  caixa(g,claro,0,.86,0,2.4,.015,.025);caixa(g,claro,0,.97,0,.025,.22,1.5);bola(g,claro,.6,.91,.3,.04);return g;
}
export function cavalete(c=0xffb020){
  const g=new THREE.Group();for(const x of [-.4,.4]){const perna=caixa(g,0xad8b64,x,.75,0,.06,1.5,.06);perna.rotation.z=x*.3;}
  const apoio=caixa(g,0xad8b64,0,.65,-.3,.06,1.3,.06);apoio.rotation.x=-.4;caixa(g,claro,0,1.15,.05,1,.85,.07);caixa(g,c,0,1.15,.095,.65,.5,.02);return g;
}
export function microfone(c=0x8ce4ef){
  const g=new THREE.Group();cilindro(g,escuro,0,.04,0,.3,.08);cilindro(g,metal,0,.7,0,.025,1.4);cilindro(g,escuro,0,1.45,0,.09,.3);bola(g,metal,0,1.65,0,.14);caixa(g,c,0,1.4,.095,.06,.05,.015);return g;
}
export function globo(c=0x62b8c5){
  const g=new THREE.Group();cilindro(g,escuro,0,.04,0,.35,.08);cilindro(g,metal,0,.45,0,.04,.8);bola(g,c,0,1,0,.42);
  const aro=peca(g,new THREE.TorusGeometry(.48,.025,6,24),metal,0,1,0);aro.rotation.z=.3;for(const [x,y,z] of [[.1,1.25,.3],[-.25,.9,.29],[.26,.84,.22]])bola(g,0x83bb94,x,y,z,.14);return g;
}

export const PROPS=Object.freeze({claquete,refletor,camera,sofa,arcade,controle,pufe,neon,servidor,quadro_branco,monitor_duplo,planta,estante,trofeu,mesa_pingpong,cavalete,microfone,globo});
