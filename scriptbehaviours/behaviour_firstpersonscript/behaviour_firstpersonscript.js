export default class BehaviourFirstPerson {
    constructor(node, props) {
        this.node = node;
        this.props = props || {};
        this.keys = {};
        this.velocity = new THREE.Vector3();
        this.canJump = true;
        this.jumpCooldownTimer = 0;
        this.isGrounded = true;
        this.bobbingPhase = 0;

        this.cam = null;
        this.baseCamY = 0;
        this.baseNodeY = null;

        this._yaw = 0;
        this._pitch = 0;
        this._listenersAdded = false;
    }

    start(engine) {
        this.engine = engine;

        if (!this.cam && this.node && this.node.children && this.node.children.length > 0) {
            this.cam = this.node.children[0];
            this.baseCamY = (this.cam.position && typeof this.cam.position.y === 'number') ? this.cam.position.y : 0;
        }
        this.baseNodeY = (this.node && this.node.position && typeof this.node.position.y === 'number') ? this.node.position.y : 0;

        try {
            const nodeEuler = new THREE.Euler().setFromQuaternion(this.node.quaternion, 'YXZ');
            this._yaw = nodeEuler.y || 0;
        } catch (e) {
            this._yaw = this.node.rotation ? (this.node.rotation.y || 0) : 0;
        }
        if (this.cam) {
            try {
                const camEuler = new THREE.Euler().setFromQuaternion(this.cam.quaternion, 'YXZ');
                this._pitch = camEuler.x || 0;
            } catch (e) {
                this._pitch = this.cam.rotation ? (this.cam.rotation.x || 0) : 0;
            }
        } else {
            this._pitch = 0;
        }

        try {
            const camTarget = this.node.userData && this.node.userData._cameraTarget ? this.node.userData._cameraTarget : null;
            if (camTarget) {
                const tp = new THREE.Vector3(); camTarget.getWorldPosition(tp);
                const wp = new THREE.Vector3(); this.node.getWorldPosition(wp);
                const m = new THREE.Matrix4();
                m.lookAt(wp, tp, new THREE.Vector3(0, 1, 0));
                const q = new THREE.Quaternion().setFromRotationMatrix(m);
                const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
                this._yaw = e.y || this._yaw;
                this._pitch = e.x || this._pitch;
            }
        } catch (e) { }

        this._pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this._pitch));

        const rs = this.props && (this.props.rotationsmooth || this.props.RotationSmooth);
        if (rs === undefined || rs === null) this._rotationSmoothingEnabled = true;
        else {
            const s = ('' + rs).toLowerCase();
            this._rotationSmoothingEnabled = (s === 'true' || s === '1');
        }
        this._slerpSpeed = parseFloat(this.props.rotationsmoothness || this.props.RotationSmoothness) || 12.0;

        if (!this._listenersAdded) {
            this._onKeyDown = (e) => { this.keys[e.code] = true; };
            this._onKeyUp = (e) => { this.keys[e.code] = false; };
            this._onMouseDown = () => { 
                try { document.body.requestPointerLock(); } catch(e) {}
            };

            // --- CORREÇÃO AQUI ---
            this._onMouseMove = (e) => {
                if (document.pointerLockElement === document.body) {
                    // FIX: Verificar se o movimento é um "pulo" irreal causado pelo navegador
                    // Se o movimento for maior que 300 pixels (num único frame), ignoramos.
                    if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;

                    const sensitivity = parseFloat(this.props.camerasensitivity) || 0.002;
                    
                    this._yaw -= e.movementX * sensitivity;
                    this._pitch -= e.movementY * sensitivity;
                    
                    this._pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this._pitch));
                    
                    if (this._yaw > Math.PI) this._yaw -= Math.PI * 2.0;
                    if (this._yaw < -Math.PI) this._yaw += Math.PI * 2.0;
                }
            };
            // ---------------------

            window.addEventListener('keydown', this._onKeyDown);
            window.addEventListener('keyup', this._onKeyUp);
            window.addEventListener('mousedown', this._onMouseDown);
            window.addEventListener('mousemove', this._onMouseMove);

            this._listenersAdded = true;
        }

        console.log("Player pronto. Clique na tela para controlar.");
    }

    _applyRotation(delta) {
        if (this._slerpSpeed === undefined) this._slerpSpeed = parseFloat(this.props.rotationsmoothness) || 12.0;
        const alpha = Math.min(1, 1 - Math.exp(-this._slerpSpeed * (delta || 0.016)));

        const yawQuat = new THREE.Quaternion();
        yawQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this._yaw);
        try {
            if (this._rotationSmoothingEnabled) this.node.quaternion.slerp(yawQuat, alpha);
            else this.node.quaternion.copy(yawQuat);
        } catch (e) {
            try { this.node.quaternion.copy(yawQuat); } catch (ee) {}
        }

        const hasCamTarget = this.node.userData && this.node.userData._cameraTarget;
        if (!hasCamTarget && this.cam) {
            const pitchQuat = new THREE.Quaternion();
            pitchQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this._pitch);
            try {
                if (this._rotationSmoothingEnabled) this.cam.quaternion.slerp(pitchQuat, alpha);
                else this.cam.quaternion.copy(pitchQuat);
            } catch (e) {
                try { this.cam.quaternion.copy(pitchQuat); } catch (ee) {}
            }
        }
    }

    update(delta) {
        this._applyRotation(delta);

        try {
            const targetDist = parseFloat(this.props.targetdistance) || 10.0;
            const worldPos = new THREE.Vector3(); this.node.getWorldPosition(worldPos);
            const eul = new THREE.Euler(this._pitch, this._yaw, 0, 'YXZ');
            const q = new THREE.Quaternion().setFromEuler(eul);
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
            const tp = worldPos.clone().add(forward.multiplyScalar(targetDist));
            const vstr = `${tp.x.toFixed(4)},${tp.y.toFixed(4)},${tp.z.toFixed(4)}`;
            try {
                if (this.node && typeof this.node.setProperty === 'function') {
                    this.node.setProperty('Target', vstr);
                } else if (this.engine && typeof this.engine.setNodeProperty === 'function') {
                    this.engine.setNodeProperty(this.node.name, 'Target', vstr);
                }
            } catch (e) {}
        } catch (e) {}

        const speed = parseFloat(this.props.playerwalkspeed) || 0.1;
        let actualSpeed = speed;
        if ((this.props.enablerun === undefined ? true : this.props.enablerun) &&
            (this.keys['ShiftLeft'] || this.keys['ShiftRight'])) {
            actualSpeed *= parseFloat(this.props.runmultiplier) || 1.8;
        }

        const move = new THREE.Vector3();
        if (this.keys['KeyW']) move.z -= 1;
        if (this.keys['KeyS']) move.z += 1;
        if (this.keys['KeyA']) move.x -= 1;
        if (this.keys['KeyD']) move.x += 1;

        const moving = move.lengthSq() > 0;
        if (moving) {
            move.normalize();
            move.applyQuaternion(this.node.quaternion);
            move.y = 0;

            try {
                const rb = this.node.userData && this.node.userData._physicsBody;
                if (rb && this.engine && this.engine.physics && this.engine.physics.world) {
                    try {
                        const t = rb.translation ? rb.translation() : { x: this.node.position.x, y: this.node.position.y, z: this.node.position.z };
                        const nx = t.x + move.x * actualSpeed;
                        const nz = t.z + move.z * actualSpeed;
                        const ny = t.y;
                        if (typeof rb.setTranslation === 'function') rb.setTranslation({ x: nx, y: ny, z: nz }, true);
                        else if (typeof rb.set_translation === 'function') rb.set_translation({ x: nx, y: ny, z: nz }, true);
                        this.node.position.set(nx, ny, nz);
                    } catch (e) {
                        this.node.position.addScaledVector(move, actualSpeed);
                    }
                } else {
                    this.node.position.addScaledVector(move, actualSpeed);
                }
            } catch (e) {
                this.node.position.addScaledVector(move, actualSpeed);
            }
        }

        const enableJump = this.props.enablejump === undefined ? true : (this.props.enablejump === true || this.props.enablejump === 'true');
        const jumpStrength = parseFloat(this.props.jumpstrength) || 5.0;
        const jumpCooldown = parseFloat(this.props.jumpcooldown) || 0.25;

        const scripts = (this.node.userData && this.node.userData._scripts) ? this.node.userData._scripts : {};
        const collisionScript = scripts.behaviour_collision || scripts.behaviour_collision_cc || null;
        const grounded = collisionScript ? !!collisionScript.grounded : this.isGrounded;

        if (enableJump && this.keys['Space'] && this.canJump && grounded) {
            if (collisionScript) {
                try {
                    collisionScript.velocity.y = jumpStrength;
                    collisionScript.grounded = false;
                } catch (e) { 
                    console.warn('Failed to apply jump to collision script', e);
                }
            } else {
                this.velocity.y = jumpStrength;
                this.isGrounded = false;
            }
            this.canJump = false;
            this.jumpCooldownTimer = jumpCooldown;
        }

        if (!collisionScript) {
            const gravity = (this.engine && this.engine.sceneGravity !== undefined) ? parseFloat(this.engine.sceneGravity) : 9.8;
            this.velocity.y -= gravity * delta;
            this.node.position.y += this.velocity.y * delta;
            const groundY = (this.baseNodeY !== null) ? this.baseNodeY : 0;
            if (this.node.position.y <= groundY) {
                this.node.position.y = groundY;
                this.velocity.y = 0;
                this.isGrounded = true;
            }
        }

        if (!this.canJump) {
            this.jumpCooldownTimer -= delta;
            if (this.jumpCooldownTimer <= 0) {
                this.canJump = true;
                this.jumpCooldownTimer = 0;
            }
        }

        const enableBobbing = this.props.enablebobbing === undefined ? true : (this.props.enablebobbing === true || this.props.enablebobbing === 'true');
        const bobbingAmount = parseFloat(this.props.bobbingamount) || 0.2;
        const bobbingFrequency = parseFloat(this.props.bobbingfrequency) || 8.0;

        if (!this.cam && this.node.children[0]) {
            this.cam = this.node.children[0];
            this.baseCamY = (this.cam.position && typeof this.cam.position.y === 'number') ? this.cam.position.y : 0;
        }

        if (enableBobbing && this.cam) {
            if (moving && grounded) {
                const runMul = actualSpeed / (speed || 1);
                this.bobbingPhase += delta * bobbingFrequency * runMul * (move.length() || 1);
                const amplitude = bobbingAmount * runMul;
                this.cam.position.y = this.baseCamY + Math.sin(this.bobbingPhase) * amplitude;
            } else {
                this.bobbingPhase = 0;
                this.cam.position.y += (this.baseCamY - this.cam.position.y) * Math.min(1, delta * 8.0);
            }
        }
    }

    dispose() {
        if (this._listenersAdded) {
            window.removeEventListener('keydown', this._onKeyDown);
            window.removeEventListener('keyup', this._onKeyUp);
            window.removeEventListener('mousedown', this._onMouseDown);
            window.removeEventListener('mousemove', this._onMouseMove);
            this._listenersAdded = false;
        }
    }
}
