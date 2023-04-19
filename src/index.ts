import {
    Editor,
    getEditorValue,
    initEditor,
    setEditorValue
} from './editor'
import {
    createProgram,
    createShader,
    createTextureFromImage,
    defaultFragmentShaderSource,
    defaultVertexShaderSource, 
    findGlobalAttributes,
    findGlobalUniforms,
    initRenderer,
    setTexture
} from './render'

import './styles.css'

const canvas = document.getElementById('canvas') as HTMLCanvasElement
if (!canvas) throw new Error('Could not find canvas element')

const gl = canvas.getContext('webgl2', { antialias: false }) as WebGL2RenderingContext
if (!gl) throw new Error('Could not get WebGL rendering context')

function resizeCanvas() {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    gl.viewport(0, 0, canvas.width, canvas.height)
}
let resizeTimeout: number
window.addEventListener('resize', function() {
    this.clearTimeout(resizeTimeout)
    resizeTimeout = this.setTimeout(resizeCanvas, 100)
})
resizeCanvas()

initRenderer(canvas, gl)

let editor: Editor | null = null
editor = initEditor(document.getElementById('editor-parent') as HTMLElement, defaultFragmentShaderSource)

const compile = document.getElementById('compile') as HTMLButtonElement
compile.addEventListener('click', recompile)
function recompile() {
    if (!editor) {
        return
    }

    const vertex = createShader(gl, gl.VERTEX_SHADER, defaultVertexShaderSource)
    const fragment = createShader(gl, gl.FRAGMENT_SHADER, getEditorValue(editor))

    const program = createProgram(gl, vertex, fragment)

    findGlobalAttributes(gl, program)
    findGlobalUniforms(gl, program)
}

const image = document.getElementById('image') as HTMLInputElement
image.addEventListener('change', function(e) {
    const input = e.target as HTMLInputElement
    if (input.files && input.files[0]) {
        loadImage(gl, input.files[0])
    }
})

function loadImage(gl: WebGL2RenderingContext, file: File) {
    const image = new Image()
    const url = URL.createObjectURL(file)

    image.onload = function() {
        const flippedImage = document.createElement("canvas") as HTMLCanvasElement
        flippedImage.width = image.width
        flippedImage.height = image.height

        const ctx = flippedImage.getContext("2d") as CanvasRenderingContext2D
        ctx.translate(0, image.height)
        ctx.scale(1, -1)
        ctx.drawImage(image, 0, 0, image.width, image.height)

        try {
            const texture = createTextureFromImage(gl, flippedImage)
            setTexture(texture)
        } catch (e) {
            console.error("Error loading image texture:", e)
            setTexture(null)
        }

        URL.revokeObjectURL(url)
    }

    image.onerror = function() {
        console.error("Error loading image file.")
        setTexture(null)
    }

    image.src = url
}

const prompt = document.getElementById('prompt') as HTMLTextAreaElement
const ask = document.getElementById('ask') as HTMLButtonElement
ask.addEventListener('click', async function() {
    if (!editor) {
        return
    }

    ask.disabled = true

    try {
        const shader = getEditorValue(editor)
        setEditorValue(editor, '')

        const encodedPrompt = encodeURIComponent(prompt.value)
        const encodedShader = encodeURIComponent(btoa(shader))

        const stream = new EventSource(`/api/ai?prompt=${encodedPrompt}&shader=${encodedShader}`)

        stream.addEventListener('message', function(e) {
            if (!editor) {
                return
            }

            if (e.data === '[DONE]') {
                stream.close()
                recompile()
                return
            }

            const message = JSON.parse(e.data)
            const delta = message.choices[0].delta.content

            if (delta) {
                const value = getEditorValue(editor)
                setEditorValue(editor, value + delta)
            }
        })
    } catch (e) {
        console.error("Failed to prompt shader: ", e)
    } finally {
        ask.disabled = false
    }
})

let isResizing = false
const container = document.getElementById('container') as HTMLDivElement
const resize = document.getElementById('resize') as HTMLButtonElement

const isMobile = () => window.innerWidth <= 767

function updateLayout() {  
    if (isMobile()) {
        container.style.width = "100%"
        container.style.height = "50%"
        canvas.style.width = "100%"
        canvas.style.height = "calc(50% - 5px)"
    } else {
        container.style.width = "50%"
        container.style.height = "100%"
        canvas.style.width = "calc(50% - 5px)"
        canvas.style.height = "100%"
    }
}
updateLayout()
window.addEventListener("resize", updateLayout)

resize.addEventListener('mousedown', function(e) {
    e.preventDefault()
    isResizing = true
})

window.addEventListener('mousemove', function(e) {
    if (!isResizing) {
        return
    }

    const event = e as MouseEvent

    if (isMobile()) {
        let containerHeight = event.clientY
        let canvasHeight = window.innerHeight - event.clientY - 5
    
        container.style.height = `${containerHeight}px`
        canvas.style.height = `${canvasHeight}px`
    } else {
        let containerWidth = event.clientX
        let canvasWidth = window.innerWidth - event.clientX - 5
    
        container.style.width = `${containerWidth}px`
        canvas.style.width = `${canvasWidth}px`
    }
})

window.addEventListener('mouseup', function() {
    isResizing = false
})

resize.addEventListener('keydown', function(e) {
    if (isMobile()) {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            let containerHeight = parseInt(container.style.height)
            let canvasHeight = parseInt(canvas.style.height)
        
            if (e.key === "ArrowUp" && containerHeight > 0) {
                containerHeight -= 10
                canvasHeight += 10
            } else if (e.key === "ArrowDown" && canvasHeight > 0) {
                containerHeight += 10
                canvasHeight -= 10
            }
        
            container.style.height = `${containerHeight}px`
            canvas.style.height = `${canvasHeight}px`
        }
    } else {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            let containerWidth = parseInt(container.style.width)
            let canvasWidth = parseInt(canvas.style.width)
        
            if (e.key === "ArrowLeft" && containerWidth > 0) {
                containerWidth -= 10
                canvasWidth += 10
            } else if (e.key === "ArrowRight"&& canvasWidth > 0) {
                containerWidth += 10
                canvasWidth -= 10
            }
    
            container.style.width = `${containerWidth}px`
            canvas.style.width = `${canvasWidth}px`
        }
    }
})

let index = 0
const tabs = document.querySelectorAll('button.tab') as NodeListOf<HTMLAnchorElement>

const setFocus = () => {
    tabs.forEach(tab => {
        tab.setAttribute('tabindex', '-1')
        tab.setAttribute('aria-selected', 'false')
        tab.classList.remove('tab-active')
    })

    const currentTab = tabs[index]
    currentTab.setAttribute('tabindex', '0')
    currentTab.setAttribute('aria-selected', 'true')
    currentTab.classList.add('tab-active')
    currentTab.focus()

    currentTab.parentElement!.classList.add('current')
    currentTab.parentElement!.parentElement!.querySelectorAll('li').forEach(li => li.classList.remove('current'))
    currentTab.parentElement!.classList.add('current')

    const tabPanel = document.querySelector(currentTab.getAttribute('href')!) as HTMLElement
    tabPanel.classList.add('current')
}

tabs.forEach((tab, tabIndex) => {
    tab.addEventListener('keydown', (ev: KeyboardEvent) => {
        const LEFT_ARROW = 37
        const UP_ARROW = 38
        const RIGHT_ARROW = 39
        const DOWN_ARROW = 40

        const k = ev.which || ev.keyCode

        if (k >= LEFT_ARROW && k <= DOWN_ARROW) {
            if (k === LEFT_ARROW || k === UP_ARROW) {
                if (index > 0) {
                    index--
                } else {
                    index = tabs.length - 1
                }
            } else if (k === RIGHT_ARROW || k === DOWN_ARROW) {
                if (index < (tabs.length - 1)) {
                    index++
                } else {
                    index = 0
                }
            }

            tabs[index].click()
            ev.preventDefault()
        }
    })

    tab.addEventListener('click', (ev: MouseEvent) => {
        index = tabIndex
        setFocus()
        ev.preventDefault()
    })
})

const tabPanels = document.querySelectorAll('.tab-panel') as NodeListOf<HTMLElement>
tabPanels.forEach(tabPanel => tabPanel.classList.remove('current'))
