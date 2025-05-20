class WasmHandler {
    constructor(gl) {
        this.gl = gl;
        this.shaders = [];
        this.glPrograms = [];
        this.glBuffers = [];
        this.glUniformLocations = [];
        this.memory = null;
    }

    readCharStr(ptr, len) {
        const bytes = new Uint8Array(this.memory.buffer, ptr, len);
        return new TextDecoder("utf-8").decode(bytes);
    }

    compileShader (sourcePtr, sourceLen, type) {
        const source = this.readCharStr(sourcePtr, sourceLen);
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if(!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            throw "Error compiling shader:" + this.gl.getShaderInfoLog(shader);
        }
        this.shaders.push(shader);
        return this.shaders.length - 1;
    }
      
    linkShaderProgram (vertexShaderId, fragmentShaderId) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, this.shaders[vertexShaderId]);
        this.gl.attachShader(program, this.shaders[fragmentShaderId]);
        this.gl.linkProgram(program);
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw ("Error linking program:" + this.gl.getProgramInfoLog (program));
        }
        this.glPrograms.push(program);
        return this.glPrograms.length - 1;
    }

    glGetAttribLocation(programId, namePtr, nameLen) {
        this.gl.getAttribLocation(
            this.glPrograms[programId],
            this.readCharStr(namePtr, nameLen)
        )
    }

    glGetUniformLocation(programId, namePtr, nameLen) {
        this.glUniformLocations.push(
            this.gl.getUniformLocation(
                this.glPrograms[programId],
                this.readCharStr(namePtr, nameLen)
            )
        );

        return this.glUniformLocations.length - 1;
    }

    glUniform4fv(locationId, x, y, z, w) {
        this.gl.uniform4fv(
            this.glUniformLocations[locationId],
            [x, y, z, w]
        )
    }

    glCreateBuffer(){
        this.glBuffers.push(this.gl.createBuffer());
        return this.glBuffers.length - 1;
    }

    logWasm(s, len) {
        if (len === 0) return;

        // `len` is the number of UTF-16 code units, so 2 bytes per unit
        const u8Buf = new Uint8Array(this.memory.buffer, s, len * 2);
        console.log(new TextDecoder("utf-16le").decode(u8Buf));
    }

    logf32(x) {
        console.log("Float from WASM:", x);
    }
}

class CanvasInputHandler {
    constructor(gl, canvas, mod) {
        this.gl = gl;
        this.canvas = canvas;
        this.mod = mod;
        this.keysPressed = new Set();

    //   this.memoryBuffer = new Uint8Array(this.mod.instance.exports.memory.buffer);

    //   // Reserve a fixed offset for your shared key string buffer
    //   this.sharedPtr = 1024;
    //   this.sharedBufferSize = 256;
        this.memory = this.mod.instance.exports.memory;
        this.inputPtr = this.mod.instance.exports.getInputStatePointer();
        // InputState struct is 3 bytes: move_left, move_right, shoot (each bool = 1 byte)
        this.inputStateView = new Uint8Array(this.memory.buffer, this.inputPtr, 3);
    }
  
    onKeyDown(ev) {
        // // check wasd
        // if (this.keysPressed.has(ev.key)) return;
        // this.keysPressed.add(ev.key);
    
        // const encoder = new TextEncoder();
        // const encodedKey = encoder.encode(ev.key);
    
        // if (encodedKey.length > this.sharedBufferSize) {
        //   console.error("Key string too long for shared buffer");
        //   return;
        // }

        // // Clear the buffer area before writing (optional)
        // this.memoryBuffer.fill(0, this.sharedPtr, this.sharedPtr + this.sharedBufferSize);

        // // Write encoded string to shared WASM memory buffer
        // this.memoryBuffer.set(encodedKey, this.sharedPtr);

        // this.mod.instance.exports.keyDown(this.sharedPtr, encodedKey.length);
        if(ev.key == 'a') {
            this.inputStateView[0] = 1;
        }else if(ev.key == 'd') {
            this.inputStateView[1] = 1;
        }else if(ev.key == 'j') {
            this.inputStateView[2] = 1;
        }
    }
    
    onKeyUp(ev) {
        // if (!this.keysPressed.has(ev.key)) return;
        // this.keysPressed.delete(ev.key);
    
        // // Notify WASM using the same shared buffer
        // const encoder = new TextEncoder();
        // const encodedKey = encoder.encode(ev.key);
    
        // if (encodedKey.length > this.sharedBufferSize) {
        //   console.error("Key string too long for shared buffer");
        //   return;
        // }
    
        // // Write encoded string again to shared buffer (optional, depending on WASM impl)
        // this.memoryBuffer.fill(0, this.sharedPtr, this.sharedPtr + this.sharedBufferSize);
        // this.memoryBuffer.set(encodedKey, this.sharedPtr);
    
        // this.mod.instance.exports.keyUp(this.sharedPtr, encodedKey.length);
        if(ev.key == 'a') {
            this.inputStateView[0] = 0;
        }else if(ev.key == 'd') {
            this.inputStateView[1] = 0;
        }else if(ev.key == 'j') {
            this.inputStateView[2] = 0;
        }
    }

    onResize() {
      this.canvas.width = canvas.clientWidth / 2.0;
      this.canvas.height = canvas.clientHeight / 2.0;
      this.gl.viewport(0, 0, canvas.width, canvas.height);
      this.mod.instance.exports.setAspect(canvasAspect(this.canvas));
    }
  
    setCanvasCallbacks() {
        // window.onresize = this.onResize.bind(this);
        this.canvas.addEventListener('keydown', this.onKeyDown.bind(this));
        this.canvas.addEventListener('keyup', this.onKeyUp.bind(this));

        // Make the canvas focusable to receive keyboard events
        this.canvas.setAttribute('tabindex', '0');
        this.canvas.focus(); // Initially focus the canvas
    }
  }

async function instantiateWasmModule(wasm_handlers) {
    const wasmEnv = {
        env: {
            compileShader: wasm_handlers.compileShader.bind(wasm_handlers),
            linkShaderProgram: wasm_handlers.linkShaderProgram.bind(wasm_handlers),
            logWasm: wasm_handlers.logWasm.bind(wasm_handlers),
            logf32: wasm_handlers.logf32.bind(wasm_handlers),
            glClearColor: (r, g, b, a) => wasm_handlers.gl.clearColor(r, g, b, a),
            glEnable: x => wasm_handlers.gl.enable(x),
            glDepthFunc: x => wasm_handlers.gl.depthFunc(x),
            glClear: x => wasm_handlers.gl.clear(x),
            glGetAttribLocation: wasm_handlers.glGetAttribLocation.bind(wasm_handlers),
            glGetUniformLocation: wasm_handlers.glGetUniformLocation.bind(wasm_handlers),
            glUniform4fv: wasm_handlers.glUniform4fv.bind(wasm_handlers),
            glCreateBuffer: wasm_handlers.glCreateBuffer.bind(wasm_handlers),
            glBindBuffer: (type, bufferId) => wasm_handlers.gl.bindBuffer(type, wasm_handlers.glBuffers[bufferId]),
            glBufferData: (type, dataPtr, count, drawType) => {
                const floats = new Float32Array(memory.buffer, dataPtr, count);
                wasm_handlers.gl.bufferData(type, floats, drawType);
            },
            glUseProgram: (programId) => wasm_handlers.gl.useProgram(wasm_handlers.glPrograms[programId]),
            glEnableVertexAttribArray: (x) => wasm_handlers.gl.enableVertexAttribArray(x),
            glVertexAttribPointer: (attribLocation, size, type, normalize, stride, offset) => {
                wasm_handlers.gl.vertexAttribPointer(attribLocation, size, type, normalize, stride, offset);
            },
            glDrawArrays: (type, offset, count) => wasm_handlers.gl.drawArrays(type, offset, count)
        }
    }

    const mod = await WebAssembly.instantiateStreaming(
        fetch("bin/index.wasm"),
        wasmEnv
    );

    wasm_handlers.memory = mod.instance.exports.memory;
    wasm_handlers.mod = mod;

    return mod;
}

async function init() {
    const canvas = document.getElementById("canvas");
    const gl = canvas.getContext('webgl2');
    gl.viewport(0, 0, canvas.width, canvas.height);

    const wasm_handler = new WasmHandler(gl);
    const mod = await instantiateWasmModule(wasm_handler);

    memory = wasm_handler.memory;
    mod.instance.exports.onInit();
    const onAnimationFrame = mod.instance.exports.onAnimationFrame;
    const canvas_callbacks = new CanvasInputHandler(gl, canvas, mod);
    canvas_callbacks.setCanvasCallbacks();

    function step(timestamp) {
        onAnimationFrame(timestamp);
        window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);
}

window.onload = init;
