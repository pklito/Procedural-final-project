import * as THREE from 'three';
import {Engine} from './engine';
import {Layer} from './physics';
import {Ground} from './entities/ground';
import {Snake} from './entities/snake';
import {Ball} from './entities/ball';
import {Star, starPoints} from './entities/star';

async function main() {
  const engine = await Engine.create();

  const bg = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({color: 0x262b33}));
  engine.scene.add(bg);

  engine.add(new Ground(engine, 0, -4, 20, 1));
  engine.add(new Star(engine, starPoints(5, 2, 0.85), -4, 2));

  const snake = engine.add(new Snake(engine, {x: 0, y: -1}));
  const ball = engine.add(new Ball(engine, {x: 0, y: 0, radius: 0.6, density: 3, layer: Layer.SNAKE}));
  snake.attachToTail(ball);

  engine.start();
}

main();
