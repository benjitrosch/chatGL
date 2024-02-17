let a_position: number | null = null

let u_time: WebGLUniformLocation | null = null
let u_mouse: WebGLUniformLocation | null = null
let u_resolution: WebGLUniformLocation | null = null

let mouseX = 0
let mouseY = 0

const raymarchSphereFragmentShader = 
`precision mediump float;

uniform float u_time;
uniform vec2 u_resolution; 

varying vec2 fragCoord;

float map(vec3 p) {
    vec3 q = mod(p + 1.5,3.0) - 1.5;
    return length(q) - 1.0;
}

vec4 raymarch(vec3 ro, vec3 rd) {
    float t = 0.0; 
    for(int i=0; i<64; i++) {
        vec3 p = ro + t * rd; 
        float d = map(p); 
        if(d<0.01) {
            return vec4(0.5 + p, 1.0); 
        }
        t += d; 
        if(t>20.0) break; 
    }
    return vec4(0.0);
}

void main() {
    vec2 uv = (fragCoord / u_resolution.x)*2.0-1.0; 
    uv.x *= u_resolution.x / u_resolution.y; 

    vec3 ro = vec3(sin(u_time/4.0)*5.0, cos(u_time/4.0)*5.0, u_time);   
    vec3 rd = normalize(vec3(uv, -1.0)); 

    vec4 col = raymarch(ro, rd);
    gl_FragColor = vec4(col);
}`

const raymarchCubeFragmentShader = 
`precision mediump float; 

uniform float u_time; 
uniform vec2 u_resolution; 
varying vec2 fragCoord; 

vec3 fractVec(vec3 p) {
    return fract(p);
}

float map(vec3 p){
    vec3 d = abs(fractVec(p) * 6.0 - 3.0)- vec3(2.0);
    return min(max(d.x,max(d.y,d.z)),0.0)+ length(max(d,0.0));
}

vec4 raymarch(vec3 ro,vec3 rd){
    float t = 0.0;
    for(int i = 0; i < 64; i++){
        vec3 p = ro + t * rd;
        float d = map(p); 
        if(d < 0.01){
            float r = 0.5 + cos(p.z + u_time) * 0.5;
            float g = 0.5 + sin(p.x + u_time) * 0.5;
            float b = 0.5 + sin(p.y + u_time) * 0.5;
            return vec4(r, g, b ,1.0);
        }
        t += d; 
        if(t > 20.0)
            break;
    }
    return vec4(0.0);
} 

void main() {
    vec2 uv =(fragCoord / u_resolution.x)* 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;
    vec3 ro = vec3(sin(u_time)* 5.0, cos(1.5)* 5.0, 10.0);
    vec3 rd = normalize(vec3(uv,-1.0)); 
    vec4 col = raymarch(ro,rd); 
    gl_FragColor = col;
}
`

const psychedelicFragmentShader = 
`precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
varying vec2 fragCoord;

float map(vec3 p) {
    p = mod(p, 4.0) - 2.0;
    float a = atan(p.x, p.y), r = length(p.xy);
    float d = sin(7.0 * (.01 * r + .5 * a + .1 * (5.0 + sin(u_time * 0.1) * 2.5))) * 0.5 + 0.5;
    return length(p) * d - 1.0;
}

vec3 normal(vec3 p) {
    vec3 q = vec3(map(p + vec3(.01,0,0)) - map(p - vec3(.01, 0, 0)),
    map(p + vec3(0, .01, 0)) - map(p-vec3(0, .01, 0)),
    map(p + vec3(0, 0, .01)) - map(p-vec3(0, 0, .01)));
    return normalize(q);
}

vec4 raymarch(vec3 ro, vec3 rd) {
    float t = 0.0; 
    vec3 p;
    for(int i = 0; i < 256; i++) {
        p = ro + rd * t;
        float d = map(p);
        if (d < .01) break;
        t += d * .9;
    }
    return vec4(.5 + normal(p), max(0.1, t));
}

void main(void) {
    vec2 p = (2.0 * fragCoord - u_resolution) / min(u_resolution.y, u_resolution.x);
    vec3 ro = vec3(0, 0, sin(u_time * 0.1) * .5);
    vec3 rd = normalize(vec3(p, -1.0));
    vec4 col = raymarch(ro, rd);
    gl_FragColor = vec4(col);
}
`

const swirlyFragmentShader = 
`precision mediump float;

varying vec2 fragCoord;
uniform vec2 u_resolution;
uniform float u_time;

vec3 rainbow(float t){
    return vec3(sin(t)*0.5 + 0.5,sin(t + 2.0*3.1415/3.0)*0.5 + 0.5,sin(t + 4.0*3.1415/3.0)*0.5 + 0.5);
}

void main() {
    vec2 uv = fragCoord / u_resolution;
    uv = uv * 2.0 - 1.0;
    
    float angle = atan(uv.y, uv.x) + u_time*0.1;
    float radius = length(uv);
    
    vec3 color = rainbow(angle);
    
    radius += 0.1 * sin(u_time + uv.x*10.);
    radius = clamp(radius, 0., 1.);
    
    color *= smoothstep(0.8, 0.85, radius);
    
    gl_FragColor = vec4(color, 1.0);
}
`

const blobFragmentShader =
`precision mediump float; 

uniform float u_time; 
uniform vec2 u_resolution; 
varying vec2 fragCoord; 

vec3 hsv2rgb(vec3 c){
    vec4 k = vec4(1.0,2.0 / 3.0,1.0 / 3.0,3.0); 
    vec3 p = abs(fract(c.xxx + k.xyz)* 6.0 - k.www); 
    return c.z * mix(k.xxx,clamp(p - k.xxx,0.0,1.0),c.y);
}

void main(){
    vec2 uv = fragCoord / u_resolution.xy * 2.0 - 1.0;
  
    uv.x += sin(u_time + uv.y * 2.0) * 0.2;
    uv.y += sin(u_time + uv.x * 2.0) * 0.2;
  
    float angle = atan(uv.x, uv.y) / (2.0 * 3.1416) + 0.5; 
    float radius = length(uv); 
    float brightness = 1.0 - smoothstep(0.4, 0.41, radius); 
    vec3 color = hsv2rgb(vec3(angle - u_time / 10.0, 1.0, 1.0)); 
  
    gl_FragColor = vec4(color * brightness, 1.0);
}
`

const spotlightFragmentShader = 
`precision mediump float;

uniform float u_time;
uniform vec2 u_resolution; 
varying vec2 fragCoord; 

void main() 
{
	vec2 uv = fragCoord / u_resolution - 0.5; 

	float silhouette = smoothstep(0.275, 0.25, length(uv-0.3*vec2(cos(u_time),sin(u_time))))
					-  smoothstep(0.27, 0.25, length(uv-0.5*vec2(cos(u_time),sin(u_time))))
					-  smoothstep(0.295, 0.3, length(uv-0.25*vec2(cos(2.5*u_time),sin(2.5*u_time))));

    vec3 color = 0.5 + 0.5*cos(u_time+uv.xyx+vec3(1,2,3));
    
	vec4 finalColor = vec4(mix(color, vec3(0, 0, 0), silhouette), 1.0);
	
	gl_FragColor = finalColor;
}
`

const wavesFragmentShader = 
`precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
varying vec2 fragCoord;

void main() {
    vec2 uv = fragCoord / u_resolution * 3.0 - 1.0;

    float a = atan(uv.x,uv.y)/3.0+u_time*0.5;
    float r = pow(pow(uv.x,2.0)+pow(uv.y,2.0),0.5);
    vec2 uv2 = vec2(sin(a),cos(a))*0.5;
    uv2.x += r*0.5;
    vec3 color = vec3(0.5+0.5*cos(u_time+uv.x+cos(uv.y+u_time)*0.5), 0.5*sin(uv.x*0.5+u_time/3.0),0.5*cos(uv.y*0.5+u_time/2.0));
    float f = 0.5+0.5*sin(u_time+ r - sin(uv.y+u_time)*3.0 + uv.x);
    vec3 finalColor = mix(color, vec3(1.0), f);

    gl_FragColor = vec4(finalColor,1.0);
}
`

const lofiFragmentShader =
`precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
varying vec2 fragCoord;

float snoise(vec3 uv, float res) {
    const vec3 s = vec3(1e0, 1e2, 1e3);
    uv *= res;
    vec3 uv0 = floor(mod(uv, res)) * s;
    vec3 uv1 = floor(mod(uv + vec3(1.), res)) * s;
    vec3 f = fract(uv);
    f = f * f * (3.0 - 2.0 * f);
    vec4 v = vec4(uv0.x + uv0.y + uv0.z, uv1.x + uv0.y + uv0.z, uv0.x + uv1.y + uv0.z, uv1.x + uv1.y + uv1.z);
    vec4 r = fract(sin(v * 1e-1) * 1e3);
    float r0 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
    r = fract(sin((v + uv1.z - uv0.z) * 1e-1) * 1e3);
    float r1 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
    return mix(r0, r1, f.z) * 2.0 - 1.0;
}

void main() {
    vec2 uv = fragCoord / u_resolution * 2.0 - 1.0;

    float t = u_time;
    float life = snoise(vec3(1.3*uv.x, .8*t + .6*uv.y, uv.y), 16.0) * 0.5 + 0.5;
    life += 0.25 * snoise(vec3(uv.x, 0.8*t + uv.y, uv.y), 10.);
    vec3 color = vec3(0.1, 0.22, 0.15) * life;
    color += 0.3*(sin(u_time)*0.2 + 0.4 + cos(uv.x + uv.y + u_time * 0.4)*0.3);

    float alpha = 0.5 + 0.5 * sin(u_time);
    vec3 colorSplit1 = vec3(color.r, color.g * alpha, color.b * (1.0-alpha));
    vec3 colorSplit2 = vec3(color.r * (1.0-alpha), color.g, color.b * alpha);

    color = mix(colorSplit1, colorSplit2, alpha);

    gl_FragColor = vec4(color,1.0);
}
`

const stripesFragmentShader = 
`precision mediump float; 

uniform float u_time; 
uniform vec2 u_resolution; 

varying vec2 fragCoord; 

#define PI 3.14159265359 

vec2 random(vec2 st){
    st = vec2(dot(st,vec2(127.1,311.7)),dot(st,vec2(269.5,183.3))); 
    return -1.0 + 2.0*fract(sin(st)*43758.5453123);
}

float noise(vec2 st){
    vec2 i = floor(st); 
    vec2 f = fract(st); 
    vec2 u = f*f*(3.0-2.0*f); 
    return mix(mix(dot(random(i + vec2(0.0,0.0)),f - vec2(0.0,0.0)),
                   dot(random(i + vec2(1.0,0.0)),f - vec2(1.0,0.0)),u.x),
               mix(dot(random(i + vec2(0.0,1.0)),f - vec2(0.0,1.0)),
                   dot(random(i + vec2(1.0,1.0)),f - vec2(1.0,1.0)),u.x),u.y);
}

vec3 hue(float h){
    return vec3(clamp( abs(mod(h*6.0-3.0,2.0)-1.0), 0.5, 1.0)) + vec3(sin(u_time), 0.3, 0.7);
}

void main(void){
    vec2 position =(2.0*fragCoord - u_resolution)/min(u_resolution.x,u_resolution.y); 
    float radius = length(position); 
    float angle = atan(position.y,position.x); 
    float n = noise(fragCoord); 
    float color = 0.5 + 0.5*cos(u_time + angle +(n + radius)*3.0); 
    float h = n*10.0 - u_time*0.15; 
    vec3 rgb = hue(h); 
    gl_FragColor = vec4(color*rgb,1.0);
}
`

const diamondsFragmentShader =
`precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
varying vec2 fragCoord;

float waveNoise(vec2 st){
     return sin(st.x*st.y*u_time)*0.5+0.5;
}

void main(){
    vec2 uv = fragCoord/u_resolution;
    uv -= 0.5;
    uv *= vec2(u_resolution.y/u_resolution.x,1.0);
    vec2 pos = (uv - 0.5) * 2.;
    float angle = atan(pos.y, pos.x);
    float radius = length(pos);
    float swirl = radius + 0.2 * sin(u_time);
    angle += swirl;
    vec2 new_pos = vec2(radius*cos(angle), radius*sin(angle)) /2. +0.5 ;
    float redColor = new_pos.y + 0.5* sin(10.0*u_time + new_pos.x*2.0*3.14159);
    redColor += waveNoise(new_pos*10.0);
    float greenColor = new_pos.y*0.3 + 0.5*sin(7.0*u_time + new_pos.x*2.0*3.14159);
    greenColor += waveNoise(new_pos*20.0);
    float blueColor = 0.5 + 0.5*sin(5.0*u_time + new_pos.x*2.0*3.14159);
    blueColor += waveNoise(new_pos*30.0);
    vec3 color = vec3(redColor,greenColor,blueColor);
    gl_FragColor = vec4(color,1.0);
}
`

const cloudsFragmentShader =
`precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
varying vec2 fragCoord;

float hash(float n){return fract(sin(n)* 43758.5453);}

float noise(vec2 x){
    vec2 p = floor(x); 
    vec2 f = fract(x); 
    f = f*f*(3.0-2.0*f); 
    float n = p.x + p.y * 57.0;
    return mix(mix(hash(n),hash(n + 1.0),f.x),mix(hash(n + 57.0),hash(n + 58.0),f.x),f.y);}

float fbm(vec2 uv) {
    float f = 0.0;
    f += 0.50000*noise( uv ); uv = uv*2.02;
    f += 0.25000*noise( uv ); uv = uv*2.03;
    f += 0.12500*noise( uv ); uv = uv*2.01;
    f += 0.06250*noise( uv );
    return f;
}
void main(){
    vec2 uv = fragCoord / u_resolution.xy;
    float color = 0.0;
    
    color += fbm( uv + u_time * 0.1 );
    color += 0.4 * fbm( uv * 3.0 + u_time * 0.05 );
    color += 0.2 * fbm( uv * 13.0 + u_time * 0.2 );
    
    color = color * 0.5 * (3.0 + fbm(uv+u_time)); 
    
    vec3 outputColor = vec3(color*0.5,color*0.6,color);
    gl_FragColor = vec4( outputColor,1.0);
}
`

const randomFragmentShaders = [
    raymarchSphereFragmentShader,
    raymarchCubeFragmentShader,
    psychedelicFragmentShader,
    swirlyFragmentShader,
    blobFragmentShader,
    spotlightFragmentShader,
    wavesFragmentShader,
    lofiFragmentShader,
    stripesFragmentShader,
    diamondsFragmentShader,
    cloudsFragmentShader,
]

export const defaultFragmentShaderSource = randomFragmentShaders[Math.floor(Math.random() * randomFragmentShaders.length)] 

export const defaultVertexShaderSource = 
`attribute vec2 a_pos;
varying vec2 fragCoord;
void main() {
    fragCoord = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}`

export function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
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

export function createProgram(gl: WebGLRenderingContext, vertex: WebGLShader, fragment: WebGLShader): WebGLProgram {
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

export function findGlobalAttributes(gl: WebGLRenderingContext, program: WebGLProgram) {
    a_position = gl.getAttribLocation(program, "a_pos")
    gl.enableVertexAttribArray(a_position)
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0)
}

export function findGlobalUniforms(gl: WebGLRenderingContext, program: WebGLProgram) {
    u_time = gl.getUniformLocation(program, "u_time")
    u_mouse = gl.getUniformLocation(program, "u_mouse")
    u_resolution = gl.getUniformLocation(program, "u_resolution")
}

export function createVertexBuffer(gl: WebGLRenderingContext, ) {
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

export function createIndexBuffer(gl: WebGLRenderingContext) {
    const indices = new Uint16Array([0, 1, 3, 1, 2, 3])

    const indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW)
}

export function render(canvas: HTMLCanvasElement, gl: WebGLRenderingContext, t = 0) {
    const { width, height } = canvas

    gl.uniform1f(u_time, t / 1000)

    const normalizedMouseX = mouseX / width;
    const normalizedMouseY = 1 - (mouseY / height);
    gl.uniform2f(u_mouse, normalizedMouseX, normalizedMouseY);

    const maxDimension = Math.max(width, height)
    const normalizedWidth = width / maxDimension
    const normalizedHeight = height / maxDimension
    gl.uniform2f(u_resolution, normalizedWidth, normalizedHeight)

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)

    requestAnimationFrame((t) => render(canvas, gl, t))
}

export function initRenderer(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
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
