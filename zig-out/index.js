let memory;

const readCharStr = (ptr, len) => {
  const bytes = new Uint8Array(memory.buffer, ptr, len);
  return new TextDecoder("utf-8").decode(bytes);
}

class WasmHandler {
    constructor(gl) {
        this.gl = gl;
        this.shaders = [];
        this.glPrograms = [];
        this.glBuffers = [];
        this.glUniformLocations = [];
        this.memory = null;
    }

    compileShader (sourcePtr, sourceLen, type) {
        const source = readCharStr(sourcePtr, sourceLen);
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
}

// initiate wasm module
async function instantiateWasmModule(wasm_handlers) {
    const wasmEnv = {
        env: {
            compileShader: wasm_handlers.compileShader.bind(wasm_handlers),
            linkShaderProgram: wasm_handlers.linkShaderProgram.bind(wasm_handlers),
            glClearColor: (r, g, b, a) => wasm_handlers.gl.clearColor(r, g, b, a),
            glEnable: x => wasm_handlers.gl.enable(x),
            glDepthFunc: x => wasm_handlers.gl.depthFunc(x),
            glClear: x => wasm_handlers.gl.clear(x),
            glGetAttribLocation: (programId, namePtr, nameLen) => {
                wasm_handlers.gl.getAttribLocation(
                    wasm_handlers.glPrograms[programId],
                    readCharStr(namePtr, nameLen)
                )
            },
            glGetUniformLocation: (programId, namePtr, nameLen) =>  {
                wasm_handlers.glUniformLocations.push(
                    wasm_handlers.gl.getUniformLocation(
                        wasm_handlers.glPrograms[programId],
                        readCharStr(namePtr, nameLen)
                    )
                );
                return wasm_handlers.glUniformLocations.length - 1;
            },
            glUniform4fv: (locationId, x, y, z, w) => {
                wasm_handlers.gl.uniform4fv(
                    wasm_handlers.glUniformLocations[locationId],
                    [x, y, z, w]
                )
            },
            glCreateBuffer: () => {
                wasm_handlers.glBuffers.push(wasm_handlers.gl.createBuffer());
                return wasm_handlers.glBuffers.length - 1;
            },
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
    // initialize canvas
    const canvas = document.getElementById("canvas");
    const gl = canvas.getContext('webgl2');
    gl.viewport(0, 0, canvas.width, canvas.height);

    const wasm_handler = new WasmHandler(gl);
    const mod = await instantiateWasmModule(wasm_handler);

    memory = wasm_handler.memory;
    mod.instance.exports.onInit();
    const onAnimationFrame = mod.instance.exports.onAnimationFrame;
    
    function step(timestamp) {
        onAnimationFrame(timestamp);
        window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);
}

window.onload = init;
