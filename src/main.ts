import * as THREE from 'three';
import { Engine, Ticks, UiTicks } from './engine';
import { Ground } from './ground';
import { Segment } from './segment';
import { Creature } from './creature';

async function main() {
  const engine = await Engine.create();
  const sceneDemo = new ExampleLevel(engine);
  sceneDemo.init();
  engine.miscTicksUi.add(sceneDemo);
  engine.miscTicks.add(sceneDemo);
  engine.start();
}

class ExampleLevel implements UiTicks, Ticks{
  public dontTick: boolean;
  constructor(private engine : Engine){}
init(){
    const engine = this.engine;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial({ color: 0x262b33 }),
    );
    engine.scene.add(bg);

    engine.add(new Ground(engine, 0, -4, 20, 1));

    const creature = engine.addCreature(new Creature(engine));

    const N       = 8;
    const baseR   = 0.4;
    const spacing = baseR * 1.6;
    const palette = [
      0x4ecdc4, 0x45b7aa, 0x3ca190, 0x338b76,
      0x2a755c, 0x215f42, 0x184928, 0x10330e,
    ];

    let prev: Segment | null = null;
    for (let i = 0; i < N; i++) {
      const r = baseR * (1 - i * 0.04);           // taper slightly
      const seg = engine.add(new Segment(engine, {
        x: -i * spacing,
        y: 0,
        shape: { type: 'circle', radius: r },
        color: palette[i % palette.length],
      }));
      creature.addSegment(seg);

      if (prev) {
        // anchor at the edge of each circle, toward each other
        creature.connect(
          prev, seg,
          { x: -baseR * 0.8, y: 0 },
          { x:  baseR * 0.8, y: 0 },
        );
      }
      prev = seg;
    }

    // Rectangle
    engine.add(new Segment(engine, {
      x: 3, y: 2,
      shape: { type: 'rect', width: 1.5, height: 0.6 },
      color: 0xd9534f,
    }));

    // Triangle
    engine.add(new Segment(engine, {
      x: -3, y: 2,
      shape: { type: 'polygon', vertices: [[0, 0.8], [-0.7, -0.4], [0.7, -0.4]] },
      color: 0xf2991f,
    }));
  }

  public update(dt: number){
  if (this.engine.inputs.justPressed('w')) {
    this.spawnRandomSegment();
  }
}

private spawnRandomSegment() {
  const rand = (min: number, max: number) => min + Math.random() * (max - min);

  // Pick a random shape type
  const kind = Math.floor(Math.random() * 3);
  let shape: any;

  if (kind === 0) {
    shape = { type: 'circle', radius: rand(0.2, 0.8) };
  } else if (kind === 1) {
    shape = { type: 'rect', width: rand(0.4, 2), height: rand(0.3, 1.5) };
  } else {
    const s = rand(0.4, 1.2);
    shape = {
      type: 'polygon',
      vertices: [[0, s], [-s * 0.9, -s * 0.5], [s * 0.9, -s * 0.5]],
    };
  }

  const seg = new Segment(this.engine, {
    x: this.engine.inputs.mouseWorld().x,
    y: this.engine.inputs.mouseWorld().y,
    shape,
    color: Math.floor(Math.random() * 0xffffff),
  });
  this.engine.add(seg);
  this.engine.drag.tryGrab(seg.rigidBody);
}

  public fixedUpdate(dt: number){

  }
}
main();
