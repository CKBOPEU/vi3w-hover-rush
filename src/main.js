import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03060c);
scene.fog = new THREE.FogExp2(0x050913, .027);
const camera = new THREE.PerspectiveCamera(58, 1, .1, 260);
camera.position.set(0, 5.5, 10.5);
camera.lookAt(0, 0, -14);

scene.add(new THREE.HemisphereLight(0x79efff, 0x07030d, 2.5));
const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(-4,8,6); scene.add(key);
const cyan = new THREE.PointLight(0x00ecff, 45, 28); cyan.position.set(-5,2,2); scene.add(cyan);
const pink = new THREE.PointLight(0xff247d, 35, 24); pink.position.set(5,1,-4); scene.add(pink);

const road = new THREE.Group(); scene.add(road);
const roadMat = new THREE.MeshStandardMaterial({color:0x07111d, roughness:.68, metalness:.4});
for(let z=8; z>-220; z-=8){
  const tile=new THREE.Mesh(new THREE.BoxGeometry(10,.12,7.4),roadMat); tile.position.set(0,-.8,z); road.add(tile);
  for(const x of [-4.65,4.65]){ const rail=new THREE.Mesh(new THREE.BoxGeometry(.07,.08,5.1),new THREE.MeshBasicMaterial({color:0x19e6f0})); rail.position.set(x,-.68,z); road.add(rail); }
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(.08,.025,3),new THREE.MeshBasicMaterial({color:0x278693})); stripe.position.set(0,-.67,z); road.add(stripe);
}

const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({color:0x8defff,size:.08}));
const pts=[]; for(let i=0;i<900;i++) pts.push((Math.random()-.5)*150,Math.random()*55-4,-Math.random()*240+15); stars.geometry.setAttribute('position',new THREE.Float32BufferAttribute(pts,3)); scene.add(stars);

const player = new THREE.Group(); scene.add(player); player.position.set(0,0,2);
const fallback = new THREE.Mesh(new THREE.ConeGeometry(1.15,3.4,5),new THREE.MeshStandardMaterial({color:0x0c2731,emissive:0x00a8b8,emissiveIntensity:.55,metalness:.9,roughness:.2})); fallback.rotation.x=Math.PI/2; player.add(fallback);
new GLTFLoader().load('/assets/vi3w-hover-racer.glb', gltf=>{
  player.remove(fallback); const model=gltf.scene; const box=new THREE.Box3().setFromObject(model); const size=box.getSize(new THREE.Vector3()); const s=3.2/Math.max(size.x,size.y,size.z); model.scale.setScalar(s); box.setFromObject(model); model.position.sub(box.getCenter(new THREE.Vector3())); model.rotation.y=Math.PI; model.position.y=.1; player.add(model);
}, undefined, ()=>{});

const obstacles=[], cores=[];
const obstacleGeo=new THREE.BoxGeometry(1.5,2.3,.8), obstacleMat=new THREE.MeshStandardMaterial({color:0xff265f,emissive:0x7e092a,emissiveIntensity:2,metalness:.5});
const coreGeo=new THREE.OctahedronGeometry(.45), coreMat=new THREE.MeshStandardMaterial({color:0x8effff,emissive:0x13dfe8,emissiveIntensity:3,metalness:.7,roughness:.15});
for(let i=0;i<12;i++){ const o=new THREE.Mesh(obstacleGeo,obstacleMat); o.position.set([-3,0,3][i%3],.35,-18-i*17-Math.random()*8); scene.add(o); obstacles.push(o); }
for(let i=0;i<16;i++){ const c=new THREE.Mesh(coreGeo,coreMat); c.position.set([-3,0,3][(i+1)%3],.15,-10-i*13); scene.add(c); cores.push(c); }

const state={running:false,x:0,targetX:0,score:0,energy:100,speed:18,best:Number(localStorage.getItem('vi3w-best')||0),boost:false};
const keys=new Set(); addEventListener('keydown',e=>{keys.add(e.code); if(['ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();}); addEventListener('keyup',e=>keys.delete(e.code));
let pointer=null;
const pointerToTrackX=clientX=>THREE.MathUtils.clamp((clientX/innerWidth-.5)*7.5,-3.25,3.25);
canvas.addEventListener('pointerdown',event=>{
  if(!state.running)return;
  pointer={id:event.pointerId,start:event.clientX,vehicle:state.targetX,type:event.pointerType};
  if(event.pointerType==='mouse')state.targetX=pointerToTrackX(event.clientX);
  try{canvas.setPointerCapture(event.pointerId);}catch{}
});
canvas.addEventListener('pointermove',event=>{
  if(!state.running)return;
  if(event.pointerType==='mouse')state.targetX=pointerToTrackX(event.clientX);
  else if(pointer?.id===event.pointerId)state.targetX=THREE.MathUtils.clamp(pointer.vehicle+(event.clientX-pointer.start)/innerWidth*8,-3.25,3.25);
});
const releasePointer=event=>{if(pointer?.id===event.pointerId)pointer=null;};
canvas.addEventListener('pointerup',releasePointer); canvas.addEventListener('pointercancel',releasePointer); canvas.addEventListener('lostpointercapture',releasePointer);
document.querySelectorAll('[data-control]').forEach(b=>{const c=b.dataset.control; for(const ev of ['pointerdown','pointerenter']) b.addEventListener(ev,()=>{ if(c==='left')keys.add('ArrowLeft'); if(c==='right')keys.add('ArrowRight'); if(c==='boost')keys.add('Space'); }); b.addEventListener('pointerup',()=>keys.clear()); b.addEventListener('pointerleave',()=>keys.clear());});
const intro=document.querySelector('#intro'), over=document.querySelector('#gameover');
function start(){ state.running=true; state.score=0; state.energy=100; state.speed=18; state.x=state.targetX=0; pointer=null; intro.classList.add('hidden'); over.classList.add('hidden'); obstacles.forEach((o,i)=>o.position.z=-18-i*17-Math.random()*8); cores.forEach((c,i)=>{c.visible=true;c.position.z=-10-i*13;}); }
document.querySelector('#start').onclick=start; document.querySelector('#restart').onclick=start;
function end(){ state.running=false; state.best=Math.max(state.best,Math.floor(state.score)); localStorage.setItem('vi3w-best',state.best); document.querySelector('#result').textContent=`Score ${String(Math.floor(state.score)).padStart(4,'0')}`; document.querySelector('#best').textContent=`Best ${String(state.best).padStart(4,'0')}`; over.classList.remove('hidden'); }
function resize(){ renderer.setSize(innerWidth,innerHeight,false); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); } addEventListener('resize',resize); resize();
const clock=new THREE.Clock();
function tick(){ requestAnimationFrame(tick); const dt=Math.min(clock.getDelta(),.04); const steer=(keys.has('ArrowLeft')||keys.has('KeyA')?-1:0)+(keys.has('ArrowRight')||keys.has('KeyD')?1:0); state.boost=keys.has('Space')&&state.energy>1&&state.running; if(state.running){ state.targetX=THREE.MathUtils.clamp(state.targetX+steer*dt*8,-3.25,3.25); const visualSteer=steer||THREE.MathUtils.clamp((state.targetX-state.x)*1.2,-1,1); state.x=THREE.MathUtils.damp(state.x,state.targetX,8,dt); player.position.x=state.x; player.rotation.z=THREE.MathUtils.damp(player.rotation.z,-visualSteer*.18,6,dt); const v=state.speed+(state.boost?13:0); state.energy=THREE.MathUtils.clamp(state.energy+(state.boost?-25:8)*dt,0,100); state.speed=Math.min(33,state.speed+dt*.35); state.score+=v*dt*2; for(const o of obstacles){o.position.z+=v*dt;o.rotation.y+=dt;if(o.position.z>8)o.position.z-=210;if(Math.abs(o.position.z-2)<1.35&&Math.abs(o.position.x-state.x)<1.15){end();break;}} if(state.running){for(const c of cores){c.position.z+=v*dt;c.rotation.x+=dt*2;c.rotation.y+=dt*3;if(c.position.z>8){c.position.z-=210;c.visible=true;} if(c.visible&&Math.abs(c.position.z-2)<1.3&&Math.abs(c.position.x-state.x)<1){c.visible=false;state.energy=Math.min(100,state.energy+22);state.score+=100;}}} } player.position.y=Math.sin(performance.now()*.004)*.08; road.position.z=(road.position.z+(state.running?state.speed*dt:4*dt))%8; camera.position.x=THREE.MathUtils.damp(camera.position.x,state.x*.22,3,dt); document.querySelector('#score').textContent=String(Math.floor(state.score)).padStart(4,'0'); document.querySelector('#energy').textContent=`${Math.max(0,Math.ceil(state.energy))}%`; document.querySelector('#speed').textContent=Math.floor(state.running?state.speed+(state.boost?13:0):0); renderer.render(scene,camera); }
tick();
