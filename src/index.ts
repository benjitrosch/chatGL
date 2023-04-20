import {
    createProgram,
    createShader,
    defaultFragmentShaderSource,
    defaultVertexShaderSource, 
    findGlobalAttributes,
    findGlobalUniforms,
    initRenderer,
} from './render'

import './styles.css'

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message)
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement
assert(!!canvas, 'Could not find canvas element')

const gl = canvas.getContext('webgl', { antialias: false }) as WebGLRenderingContext
assert(!!gl, 'Could not get WebGL rendering context')

function debounce(func: () => void, wait: number): () => void {
    let timeout: ReturnType<typeof setTimeout> | null
    return function () {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(func, wait)
    }
}

function resizeCanvas() {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    gl.viewport(0, 0, canvas.width, canvas.height)
}

window.addEventListener('resize', debounce(resizeCanvas, 100))
resizeCanvas()

initRenderer(canvas, gl)

function recompile() {
    const vertex = createShader(gl, gl.VERTEX_SHADER, defaultVertexShaderSource)
    const fragment = createShader(gl, gl.FRAGMENT_SHADER, editor.innerText)

    const program = createProgram(gl, vertex, fragment)

    findGlobalAttributes(gl, program)
    findGlobalUniforms(gl, program)
}

const editor = document.getElementById('editor') as HTMLElement
editor.innerText = defaultFragmentShaderSource
editor.addEventListener('keyup', debounce(recompile, 1000))

const prompt = document.getElementById('prompt') as HTMLTextAreaElement
prompt.addEventListener('keyup', async function(e) {
    if (e.key !== 'Enter') {
        return
    }

    prompt.disabled = true

    try {
        const shader = editor.innerText
        editor.innerText = ''

        const encodedPrompt = encodeURIComponent(prompt.value)
        const encodedShader = encodeURIComponent(btoa(shader))

        const stream = new EventSource(`/api/ai?prompt=${encodedPrompt}&shader=${encodedShader}`)

        stream.addEventListener('message', function(e) {
            if (e.data === '[DONE]') {
                stream.close()
                recompile()
                return
            }

            const message = JSON.parse(e.data)
            const delta = message.choices[0].delta.content

            if (delta) {
                editor.innerText += delta
            }
        })
    } catch (e) {
        console.error("Failed to prompt shader: ", e)
    } finally {
        prompt.disabled = false
    }
})

let isResizing = false
const container = document.getElementById('container') as HTMLDivElement
const resize = document.getElementById('resize') as HTMLButtonElement

const MOBILE_BREAKPOINT = 767
const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT

function setStyles(element: HTMLElement, styles: { [key: string]: string }) {
    Object.assign(element.style, styles)
}

function updateLayout() {  
    if (isMobile()) {
        setStyles(container, { width: "100%", height: "50%" })
        setStyles(canvas, { width: "100%", height: "calc(50% - 1rem)" })
    } else {
        setStyles(container, { width: "50%", height: "100%" })
        setStyles(canvas, { width: "calc(50% - 1rem)", height: "100%" })
    }
}
updateLayout()
window.addEventListener("resize", updateLayout)

resize.addEventListener('mousedown', function(e) {
    e.preventDefault()
    isResizing = true
})

const RESIZE_DELTA = 10

window.addEventListener('mousemove', function(e) {
    if (!isResizing) {
        return
    }

    const event = e as MouseEvent

    if (isMobile()) {
        let containerHeight = event.clientY
        let canvasHeight = window.innerHeight - event.clientY - RESIZE_DELTA
    
        setStyles(container, { height: `${containerHeight}px` })
        setStyles(canvas, { height: `${canvasHeight}px` })
    } else {
        let containerWidth = event.clientX
        let canvasWidth = window.innerWidth - event.clientX - RESIZE_DELTA
    
        setStyles(container, { width: `${containerWidth}px` })
        setStyles(canvas, { width: `${canvasWidth}px` })
    }
})

window.addEventListener('mouseup', function() {
    isResizing = false
})

resize.addEventListener('keydown', function(e) {
    const updateSize = (dim: 'width' | 'height', delta: number) => {
        const containerSize = parseInt(container.style[dim])
        const canvasSize = parseInt(canvas.style[dim])

        const newContainerSize = containerSize + delta
        const newCanvasSize = canvasSize - delta

        if (newContainerSize > 0 && newCanvasSize > 0) {
            setStyles(container, { [dim]: `${newContainerSize}px` })
            setStyles(canvas, { [dim]: `${newCanvasSize}px` })
        }
    }

    if (isMobile()) {
        if (e.key === "ArrowUp") {
            updateSize('height', -10)
        } else if (e.key === "ArrowDown") {
            updateSize('height', 10)
        }
    } else {
        if (e.key === "ArrowLeft") {
            updateSize('width', -10)
        } else if (e.key === "ArrowRight") {
            updateSize('width', 10)
        }
    }
})
