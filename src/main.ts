import * as THREE from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {Engine} from './engine';
import {DynamicStar, Snake, Ground} from './object';
import {Physics} from './physics';

function starPoints(tips: number, outer: number, inner: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < tips * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / tips;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

const flat = (color: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({color});

async function main() {
const engine = new Engine();
engine.start();
await Physics.init();

const bg = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), flat(0x262b33));
engine.scene.add(bg);


const lineMat = new LineMaterial({color: 0xffffff, linewidth: 0.12, worldUnits: true});

const lineGeo = new LineGeometry();
lineGeo.setPositions([2, 3, 0.15, 6, 1, 0.15]);
engine.scene.add(new Line2(lineGeo, new LineMaterial({color: 0xccddff, linewidth: 0.08, worldUnits: true})));

new Ground(0, -4, 20, 1);
new Snake();
  new DynamicStar(starPoints(5, 2, 0.85), -4, 2);
}

main();