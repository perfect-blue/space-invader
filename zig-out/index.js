let memory;

const readCharStr = (ptr, len) => {
  const bytes = new Uint8Array(memory.buffer, ptr, len);
  return new TextDecoder("utf-8").decode(bytes);
}

// initialize canvas
const canvas = document.getElementById("canvas");
const gl = canvas.getContext('webgl2');
gl.viewport(0, 0, canvas.width, canvas.height);

const shaders = [];
const glPrograms = [];
const glBuffers = [];
const glUniformLocations = [];

const compileShader = (sourcePtr, sourceLen, type) => {
  const source = readCharStr(sourcePtr, sourceLen);
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw "Error compiling shader:" + gl.getShaderInfoLog(shader);
  }
  shaders.push(shader);
  return shaders.length - 1;
}

const linkShaderProgram = (vertexShaderId, fragmentShaderId) => {
  const program = gl.createProgram();
  gl.attachShader(program, shaders[vertexShaderId]);
  gl.attachShader(program, shaders[fragmentShaderId]);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw ("Error linking program:" + gl.getProgramInfoLog (program));
  }
  glPrograms.push(program);
  return glPrograms.length - 1;
}

class WasmHandler {
    constructor(gl) {
        this.gl = gl;
        this.memory = null;
    }

    linkShaderProgram(vertexShaderId, fragmentShaderId){};
    bind2DFloat32Data(ptr, len) {};
    glCreateVertexArray(){};
    glDeleteVertexArray(id){};
    glCreateBuffer(){};
    glDeleteBuffer(){};

}

// initiate wasm module
async function instantiateWasmModule(wasm_handlers) {
    const wasmEnv = {
        env: {
            compileShader: compileShader,
            linkShaderProgram: linkShaderProgram,
            glClearColor: (r, g, b, a) => gl.clearColor(r, g, b, a),
            glEnable: x => gl.enable(x),
            glDepthFunc: x => gl.depthFunc(x),
            glClear: x => gl.clear(x),
            glGetAttribLocation: (programId, namePtr, nameLen) => gl.getAttribLocation(glPrograms[programId], readCharStr(namePtr, nameLen)),
            glGetUniformLocation: (programId, namePtr, nameLen) =>  {
                glUniformLocations.push(gl.getUniformLocation(glPrograms[programId], readCharStr(namePtr, nameLen)));
                return glUniformLocations.length - 1;
            },
            glUniform4fv: (locationId, x, y, z, w) => gl.uniform4fv(glUniformLocations[locationId], [x, y, z, w]),
            glCreateBuffer: () => {
                glBuffers.push(gl.createBuffer());
                return glBuffers.length - 1;
            },
            glBindBuffer: (type, bufferId) => gl.bindBuffer(type, glBuffers[bufferId]),
            glBufferData: (type, dataPtr, count, drawType) => {
                const floats = new Float32Array(memory.buffer, dataPtr, count);
                gl.bufferData(type, floats, drawType);
            },
            glUseProgram: (programId) => gl.useProgram(glPrograms[programId]),
            glEnableVertexAttribArray: (x) => gl.enableVertexAttribArray(x),
            glVertexAttribPointer: (attribLocation, size, type, normalize, stride, offset) => {
                gl.vertexAttribPointer(attribLocation, size, type, normalize, stride, offset);
            },
            glDrawArrays: (type, offset, count) => gl.drawArrays(type, offset, count)
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
    const wasm_handler = new WasmHandler();
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
