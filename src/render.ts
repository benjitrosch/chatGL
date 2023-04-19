let a_position: number | null = null

let u_time: WebGLUniformLocation | null = null
let u_mouse: WebGLUniformLocation | null = null
let u_resolution: WebGLUniformLocation | null = null
let u_texture: WebGLUniformLocation | null = null

let texture: WebGLTexture | null = null

let mouseX = 0
let mouseY = 0

export const defaultVertexShaderSource = 
`#version 300 es
in vec2 a_position;
out vec2 fragCoord;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    fragCoord = a_position * 0.5 + 0.5;
}`

export const defaultFragmentShaderSource = 
`#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution; 
uniform sampler2D u_texture;

in vec2 fragCoord;
out vec4 fragColor;

void main() {
    vec4 tex = texture(u_texture, fragCoord);

    float aspectRatio = u_resolution.x / u_resolution.y;
    vec2 uv = fragCoord * vec2(aspectRatio, 1.0);
    vec2 center = u_mouse.xy * vec2(0.5 * aspectRatio, 0.5) + vec2(0.5);
    
    float radius = 0.5 * (1.3 + sin(u_time)) * 0.2;
    float edgeWidth = 0.03;
    float dist = distance(uv, center);
    float edge = smoothstep(radius - edgeWidth, radius, dist);

    float sinTime = 0.5 * (1.0 + sin(u_time));
    float cosTime = 0.5 * (1.0 + cos(u_time));

    vec3 circleColor = mix(tex.rgb, vec3(sinTime, 0.3, cosTime), edge);
    vec3 backgroundColor = vec3(uv.x, uv.y, sinTime);
    vec3 color = mix(backgroundColor, circleColor, step(dist, radius));

    fragColor = vec4(color, 1.0);
}`

export function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)

    if (!shader) {
        throw new Error('Failed to create shader: could not create shader object')
    }

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Failed to create shader: ", gl.getShaderInfoLog(shader))
    }

    return shader
}

export function createProgram(gl: WebGL2RenderingContext, vertex: WebGLShader, fragment: WebGLShader): WebGLProgram {
    const program = gl.createProgram()

    if (!program) {
        throw new Error('Failed to create program: could not create program object')
    }

    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)

    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.useProgram(program)
    } else {
        console.error("Failed to link program: ", gl.getProgramInfoLog(program))
    }

    return program
}

export function findGlobalAttributes(gl: WebGL2RenderingContext, program: WebGLProgram) {
    a_position = gl.getAttribLocation(program, "a_position")
    gl.enableVertexAttribArray(a_position)
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0)
}

export function findGlobalUniforms(gl: WebGL2RenderingContext, program: WebGLProgram) {
    u_time = gl.getUniformLocation(program, "u_time")
    u_mouse = gl.getUniformLocation(program, "u_mouse")
    u_resolution = gl.getUniformLocation(program, "u_resolution")
}

export function createVertexBuffer(gl: WebGL2RenderingContext, ) {
    const vertices = new Float32Array([
        -1,  1,
         1,  1,
         1, -1,
        -1, -1
    ])
    
    const vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
}

export function createIndexBuffer(gl: WebGL2RenderingContext) {
    const indices = new Uint16Array([0, 1, 3, 1, 2, 3])

    const indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW)
}

export function createTextureFromImage(gl: WebGL2RenderingContext, image: TexImageSource): WebGLTexture {
    const texture = gl.createTexture()

    if (!texture) {
        throw new Error("Failed to create texture.")
    }

    gl.bindTexture(gl.TEXTURE_2D, texture)

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    if (gl.getError() !== gl.NO_ERROR) {
        throw new Error("Failed to set texture image data.")
    }

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    gl.bindTexture(gl.TEXTURE_2D, null)

    return texture
}

export function setTexture(newTexture: WebGLTexture | null) {
    texture = newTexture
}

export function render(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, t = 0) {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    gl.uniform1f(u_time, t / 1000)

    const normalizedMouseX = (mouseX / width) * 2 - 1
    const normalizedMouseY = -(mouseY / height) * 2 + 1
    gl.uniform2f(u_mouse, normalizedMouseX, normalizedMouseY)

    const maxDimension = Math.max(width, height)
    const normalizedWidth = width / maxDimension
    const normalizedHeight = height / maxDimension
    gl.uniform2f(u_resolution, normalizedWidth, normalizedHeight)

    if (texture) {
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.uniform1i(u_texture, 0)
    }

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)

    requestAnimationFrame((t) => render(canvas, gl, t))
}

export function initRenderer(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    const vertex = createShader(gl, gl.VERTEX_SHADER, defaultVertexShaderSource)
    const fragment = createShader(gl, gl.FRAGMENT_SHADER, defaultFragmentShaderSource)

    const program = createProgram(gl, vertex, fragment)

    createVertexBuffer(gl)
    createIndexBuffer(gl)

    findGlobalAttributes(gl, program)
    findGlobalUniforms(gl, program)

    mouseX = canvas.clientWidth / 2
    mouseY = canvas.clientHeight / 2

    canvas.addEventListener('mousemove', function(e) {
        const rect = canvas.getBoundingClientRect()
    
        mouseX = e.clientX - rect.left
        mouseY = e.clientY - rect.top
    })

    gl.clearColor(0, 0, 0, 1)
    gl.enable(gl.DEPTH_TEST)
    
    render(canvas, gl)
}
