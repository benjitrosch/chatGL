import {
    collapsePanel,
    expandPanel,
    hidePanel,
    showPanel
} from './animation'
import {
    createProgram,
    createShader,
    defaultFragmentShaderSource,
    defaultVertexShaderSource, 
    findGlobalAttributes,
    findGlobalUniforms,
    initRenderer,
} from './render'

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

let acknowledged = false
function acknowledge() {
    acknowledged = true
    
    hidePanel(modalPanel, 0)
    const modal = document.getElementById('modal') as HTMLDialogElement
    setTimeout(() => {
        prompt.focus()
        modal.classList.remove('modal')
    }, 400)

    showPanel(promptPanel, 500)
    showPanel(editorPanel, 700)
}

const promptPanel = document.getElementById('prompt-panel') as HTMLDivElement
const historyPanel = document.getElementById('history-panel') as HTMLDivElement
const editorPanel = document.getElementById('editor-panel') as HTMLDivElement
const modalPanel = document.getElementById('modal-panel') as HTMLDivElement
const modalButton = document.getElementById('modal-button') as HTMLButtonElement
modalButton.addEventListener('click', acknowledge)

const editor = document.getElementById('editor') as HTMLElement
editor.innerText = defaultFragmentShaderSource
// editor.addEventListener('keyup', debounce(recompile, 1000))
editor.addEventListener('keydown', function(e) {
    if (e.key === "Backspace" ||
        e.key === "Delete") {
        setTimeout(function () {
            const content = editor.textContent ?? ''
            if (content.trim() === "") {
                editor.innerText = ""
                const range = document.createRange()
                const sel = window.getSelection()
                range.setStart(editor.childNodes[0], 1)
                range.collapse(true)
                sel?.removeAllRanges()
                sel?.addRange(range)
            }
        }, 0)
    }

    // if (e.key === 'Tab') {
    //     e.preventDefault()

    //     const selection = window.getSelection() as Selection
    //     const range = selection.getRangeAt(0)

    //     if (!e.shiftKey) {
    //         const tabNode = document.createTextNode('\t')
    //         range.insertNode(tabNode)
    
    //         range.setStartAfter(tabNode)
    //         range.setEndAfter(tabNode)
    //         selection.removeAllRanges()
    //         selection.addRange(range)
    //     }
    // }
})
editor.addEventListener('paste', function(e) {
    if (!e.clipboardData) {
        return
    }
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    const selection = window.getSelection() as Selection
    const range = selection.getRangeAt(0)
    const textNode = document.createTextNode(text)
    range.deleteContents()
    range.insertNode(textNode)

    range.setStartAfter(textNode)
    range.setEndAfter(textNode)
    selection.removeAllRanges()
    selection.addRange(range)
})

type PromptHistoryItem = { prompt: string, output: string }
const promptHistory: PromptHistoryItem[] = []
const history = document.getElementById('history') as HTMLUListElement

function askPrompt() {
    prompt.disabled = true

    logo.classList.remove('error')
    logo.classList.add('spin')

    const shader = editor.innerText
    editor.innerText = ""

    const encodedPrompt = encodeURIComponent(prompt.value)
    const encodedShader = encodeURIComponent(btoa(shader))

    const stream = new EventSource(`/api/ai?prompt=${encodedPrompt}&shader=${encodedShader}`)

    stream.addEventListener('message', function(e) {
        if (e.data === '[DONE]') {
            stream.close()

            compileButton.focus()
            compileButton.click()
                
            logo.classList.remove('spin')

            const i = promptHistory.length
            function restoreFromHistory() {
                editor.innerText = promptHistory[i].output
                recompile()
            }

            promptHistory.push({ prompt: prompt.value, output: editor.innerText })
            const historyItem = document.createElement('li')
            historyItem.innerHTML = `&emsp;* ${prompt.value}`
            historyItem.tabIndex = 0
            historyItem.classList.add('history-item')
            historyItem.addEventListener('click', restoreFromHistory)
            historyItem.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' ||
                    e.key === 'Space') {
                    e.preventDefault()
                    restoreFromHistory()
                }
            })
            history.prepend(historyItem)
            showPanel(historyPanel, 0)

            prompt.disabled = false
            prompt.value = ''
            prompt.focus()
            promptPanel.classList.remove('panel-expanded')
            return
        }

        const message = JSON.parse(e.data)
        const delta = message.choices[0].delta.content

        if (delta) {
            editor.innerText += delta
        }
    })

    stream.addEventListener('error', function(e) {
        function error() {
            prompt.disabled = false
            prompt.focus()
                
            logo.classList.remove('spin')
            logo.classList.add('error')
        }

        const event = e.target as EventSource
        if (event.readyState === EventSource.CLOSED) {
            console.log('EventSource connection closed')
            error()
        } else if (event.readyState === EventSource.CONNECTING) {
            console.log('EventSource connection failed. Retrying...')
        } else {
            console.error('EventSource encountered an unknown error:', e)
            error()
        }
    })
}

const logo = document.getElementById('openai-logo') as HTMLButtonElement
logo.addEventListener('click', askPrompt)

const prompt = document.getElementById('prompt') as HTMLTextAreaElement
prompt.addEventListener('input', function() {
    if (prompt.value.length > 32) promptPanel.classList.add('panel-expanded')
    else promptPanel.classList.remove('panel-expanded')
})
prompt.addEventListener('keyup', async function(e) {
    if (e.key !== 'Enter' ||
        prompt.value.trim().length < 1) {
        return
    }

    askPrompt()
})

const compileButton = document.getElementById('compile-button') as HTMLButtonElement
compileButton.addEventListener('click', recompile, false)

const historyToggle = document.getElementById('history-toggle') as HTMLLabelElement
const shaderToggle = document.getElementById('shader-toggle') as HTMLLabelElement

window.addEventListener('keydown', function(e) {
    const activeElement = this.document.activeElement?.id

    if (activeElement) {
        if (activeElement === 'editor' ||
            activeElement === 'prompt') {
            return
        }
    }

    if (!acknowledged) {
        if (e.key === 'a' || e.key === 'A') {
            e.preventDefault()
            modalButton.focus()
            modalButton.click()
        }
        return
    }

    switch (e.key) {
        case 'c':
        case 'C':
            e.preventDefault()
            compileButton.focus()
            compileButton.click()
            break

        case 'a':
        case 'A':
        case 'q':
        case 'Q':
            e.preventDefault()
            prompt.focus()
            break

        case 'h':
        case 'H':
            e.preventDefault()
            historyToggle.focus()
            historyToggle.click()
            break

        case 's':
        case 'S':
            e.preventDefault()
            shaderToggle.focus()
            shaderToggle.click()
            break
    }
})

// const colorPicker = document.getElementById('color-picker') as HTMLInputElement
// colorPicker.addEventListener('input', function(e) {
//     const event = e.target as HTMLInputElement
//     document.documentElement.style.setProperty('--color', event.value)
// })

// const randomStartColor = `hsl(${Math.floor(Math.random() * 360)}, 71%, 57%)`
// colorPicker.value = randomStartColor
// document.documentElement.style.setProperty('--color', randomStartColor)

document.querySelectorAll('.panel-legend-expand-button').forEach((label) => {
    label.addEventListener('click', (e) => {
        const event = e.target as HTMLDivElement
        const targetElement = event.parentElement?.nextElementSibling as HTMLDivElement
        const isVisible = !targetElement.classList.contains('collapsed')
    
        if (isVisible) {
            collapsePanel(targetElement)
        } else {
            expandPanel(targetElement)
        }
    })
})
