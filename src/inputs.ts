import { Vector3 } from "three";
import { Engine } from "./engine";


export class InputManager{
    private mouse = new Vector3();
    private keysHeld: Set<string>;
    private keysJustPressed: Set<string>;
    constructor(private engine: Engine){
        this.engine.canvas.addEventListener('mousemove', (e) => {
        this.mouse
            .set(
            (e.clientX / window.innerWidth)  *  2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1,
            0,
            )
            .unproject(this.engine.camera);
        });

        window.addEventListener('keydown', (e) => {
            if(!this.keysHeld.has(e.key.toLowerCase())){
                this.keysJustPressed.add(e.key.toLowerCase());
            }
            this.keysHeld.add(e.key.toLowerCase());
        });

        window.addEventListener('keyup', (e) => {
            this.keysHeld.delete(e.key.toLowerCase());
        });

        this.engine.canvas.addEventListener('mousedown', (e) => {
            if(!this.keysHeld.has('mouse')){
                this.keysJustPressed.add('mouse');
            }
            this.keysHeld.add('mouse');
        })

        
        this.engine.canvas.addEventListener('mouseup', (e) => {
            this.keysHeld.delete('mouse');
            
        })
        
    }


}
