import * as THREE from 'three';
import {Physics, FIXED_DT} from './physics';
import type {Entity} from './entity';

const VIEW_HEIGHT = 10;
const MAX_FRAME = 0.1; // avoid spiral of death after tab switch

export class Engine {
  //Engine has all the features I need.
  readonly canvas = document.getElementById('canvas') as HTMLCanvasElement;
  readonly renderer = new THREE.WebGLRenderer({canvas: this.canvas, antialias: true});
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  readonly mouse = new THREE.Vector3();
  private readonly clock = new THREE.Clock();
  private readonly entities = new Set<Entity>();
  private accumulator = 0;
  private debug?: THREE.LineSegments;

  static async create() {
    return new Engine(await Physics.create());
  }

  private constructor(readonly physics: Physics) {
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x1a1c1f);
    this.camera.position.z = 10;

    this.canvas.addEventListener('mousemove', (e) => {
      this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1, 0)
        .unproject(this.camera);
    });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyP') this.toggleDebug(); });
    this.resize();
  }

  add<T extends Entity>(entity: T): T {
    this.entities.add(entity);
    this.scene.add(entity.object);
    return entity;
  }

  remove(entity: Entity) {
    if (!this.entities.delete(entity)) return;
    this.scene.remove(entity.object);
    entity.dispose();
  }

  resize() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = (-VIEW_HEIGHT * aspect) / 2;
    this.camera.right = (VIEW_HEIGHT * aspect) / 2;
    this.camera.top = VIEW_HEIGHT / 2;
    this.camera.bottom = -VIEW_HEIGHT / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  start() {
    this.renderer.setAnimationLoop(() => {
      this.accumulator += Math.min(this.clock.getDelta(), MAX_FRAME);
      while (this.accumulator >= FIXED_DT) {
        for (const e of this.entities) e.fixedUpdate(FIXED_DT);
        this.physics.step();
        this.accumulator -= FIXED_DT;
      }
      for (const e of this.entities) e.sync();
      this.updateDebug();
      this.renderer.render(this.scene, this.camera);
    });
  }

  private toggleDebug() {
    if (this.debug) {
      this.scene.remove(this.debug);
      this.debug = undefined;
      return;
    }
    this.debug = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({color: 0x00ff88, depthTest: false}));
    this.debug.position.z = 5;
    this.debug.frustumCulled = false;
    this.scene.add(this.debug);
  }

  private updateDebug() {
    if (!this.debug) return;
    const v = this.physics.world.debugRender().vertices; // x,y pairs
    const pos = new Float32Array((v.length / 2) * 3);
    for (let i = 0, j = 0; i < v.length; i += 2, j += 3) { pos[j] = v[i]; pos[j + 1] = v[i + 1]; }
    this.debug.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  }
}
