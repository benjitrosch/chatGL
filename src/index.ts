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

function rebuild() {
    const vertex = createShader(gl, gl.VERTEX_SHADER, defaultVertexShaderSource)
    const fragment = createShader(gl, gl.FRAGMENT_SHADER, editor.innerText)

    const program = createProgram(gl, vertex, fragment)

    findGlobalAttributes(gl, program)
    findGlobalUniforms(gl, program)
}

const promptPanel = document.getElementById('prompt-panel') as HTMLDivElement
const configPanel = document.getElementById('config-panel') as HTMLDivElement
const historyPanel = document.getElementById('history-panel') as HTMLDivElement
const editorPanel = document.getElementById('editor-panel') as HTMLDivElement
const errorsPanel = document.getElementById('errors-panel') as HTMLDivElement
const modalPanel = document.getElementById('modal-panel') as HTMLDivElement
const modalButton = document.getElementById('modal-button') as HTMLButtonElement

let acknowledged = !!localStorage.getItem('acknowledged')

function acknowledge(skip: boolean) {
    const basedelay = skip ? 0 : 400

    acknowledged = true
    localStorage.setItem('acknowledged', 'ok')
    
    hidePanel(modalPanel, 0)
    const modal = document.getElementById('modal') as HTMLDialogElement
    setTimeout(() => {
        prompt.focus()
        modal.classList.remove('modal')
    }, basedelay)

    showPanel(promptPanel, basedelay + 100)
    showPanel(configPanel, basedelay + 300)
    showPanel(editorPanel, basedelay + 500)
}

if (acknowledged) {
    acknowledge(true)
} else {
    modalButton.addEventListener('click', () => acknowledge(false))
}

const editor = document.getElementById('editor') as HTMLElement
editor.innerText = defaultFragmentShaderSource
// editor.addEventListener('keyup', debounce(rebuild, 1000))
editor.addEventListener('keydown', function(e) {
    if (e.key === 'Backspace' ||
        e.key === 'Delete') {
        setTimeout(function () {
            const content = editor.textContent ?? ''
            if (content.trim() === '') {
                editor.innerText = ''
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
type PromptErrorItem = { status: string, message: string }

const promptHistory: PromptHistoryItem[] = []
const promptErrors: PromptErrorItem[] = []

const history = document.getElementById('history') as HTMLUListElement
const errors = document.getElementById('error-messages') as HTMLUListElement

function askPrompt() {
    prompt.disabled = true

    logo.classList.remove('error')
    logo.classList.add('spin')

    const shader = editor.innerText
    editor.innerText = ''

    const encodedPrompt = encodeURIComponent(prompt.value)
    const encodedShader = encodeURIComponent(btoa(shader))

    const url = new URL(window.location + 'api/ai')
    url.searchParams.set('prompt', encodedPrompt)
    if (shader.trim().length > 0) url.searchParams.set('shader', encodedShader)
    if (apiKey.value.trim().length > 0) url.searchParams.set('apiKey', apiKey.value)

    const stream = new EventSource(url)

    stream.addEventListener('message', function(e) {
        const message = JSON.parse(e.data)
        const delta = message.choices[0].delta.content

        if (delta) {
            editor.innerText += delta
        }
    })

    stream.addEventListener('stream-complete', function() {
        stream.close()

        buildButton.focus()
        buildButton.click()
            
        logo.classList.remove('spin')

        const i = promptHistory.length
        function restoreFromHistory() {
            editor.innerText = promptHistory[i].output
            rebuild()
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
    })

    stream.addEventListener('error', function(e) {
        function error(e?: PromptErrorItem) {
            prompt.disabled = false
            prompt.focus()
                
            logo.classList.remove('spin')
            logo.classList.add('error')

            const time = new Date().toTimeString().split(' ')[0]
            const status = e?.status || 'ERR'
            const message = e?.message || 'An unkown error occured!'

            promptErrors.push({ status, message })

            const errorItem = document.createElement('li')
            errorItem.innerHTML = `${time} <strong>[${status}]</strong> ${message}`
            errorItem.tabIndex = 0
            errorItem.classList.add('errors-item')
            errors.prepend(errorItem)

            showPanel(errorsPanel, 0)

            stream.close()
        }

        const event = e.target as EventSource

        if (event.readyState === EventSource.CLOSED) {
            console.log('EventSource connection closed')

            error()
        } else if (event.readyState === EventSource.CONNECTING) {
            console.log('EventSource connection failed. Retrying...')
        } else {
            console.error('EventSource encountered an unknown error:', e)

            const data = JSON.parse((e as any).data)
            error(data)
        }
    })
}

const logo = document.getElementById('openai-logo') as HTMLButtonElement
const prompt = document.getElementById('prompt') as HTMLInputElement 

logo.addEventListener('click', askPrompt)
prompt.addEventListener('input', function() {
    if (prompt.value.length > 32) promptPanel.classList.add('panel-expanded')
    else promptPanel.classList.remove('panel-expanded')
})
prompt.addEventListener('keyup', function(e) {
    if (e.key !== 'Enter' ||
        prompt.value.trim().length < 1) {
        return
    }

    askPrompt()
})

const apiKey= document.getElementById('api-key') as HTMLInputElement 

const container = document.getElementById('container') as HTMLDivElement
const windowAnchorRadio = document.getElementsByName('window-layout') as NodeListOf<HTMLInputElement> 

for (let radio of windowAnchorRadio) {
    radio.addEventListener('change', function() {
        console.log(radio.value)
        switch (radio.value) {
            case 'left':
                container.style.alignItems = 'start'
                break

            case 'bottom':
                container.style.alignItems = 'center'
                break

            case 'right':
                container.style.alignItems = 'end'
                break
        }
    })
}

const buildButton = document.getElementById('build-button') as HTMLButtonElement

buildButton.addEventListener('click', rebuild, false)

const configToggle = document.getElementById('config-toggle') as HTMLLabelElement
const historyToggle = document.getElementById('history-toggle') as HTMLLabelElement
const shaderToggle = document.getElementById('shader-toggle') as HTMLLabelElement
const errorsToggle = document.getElementById('errors-toggle') as HTMLLabelElement

window.addEventListener('keydown', function(e) {
    const activeElement = this.document.activeElement?.id

    if (activeElement) {
        if (activeElement === 'editor' ||
            activeElement === 'prompt' ||
            activeElement === 'api-key') {
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
        case 'a':
        case 'A':
        case 'q':
        case 'Q':
            e.preventDefault()
            prompt.focus()
            break

        case 'c':
        case 'C':
            e.preventDefault()
            configToggle.focus()
            configToggle.click()
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

        case 'b':
        case 'B':
            e.preventDefault()
            buildButton.focus()
            buildButton.click()
            break

        case 'v':
        case 'V':
            e.preventDefault()
            shareButton.focus()
            shareButton.click()
            break

        case 'e':
        case 'E':
            e.preventDefault()
            errorsToggle.focus()
            errorsToggle.click()
            break
    }
})

// https://stackoverflow.com/questions/36721830/convert-hsl-to-rgb-and-hex
function hslToHex(h: number, s: number, l: number) {
  l /= 100
  const a = s * Math.min(l, 1 - l) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')   // convert to Hex and prefix "0" if needed
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const randomStartColor = `hsl(${Math.floor(Math.random() * 360)}, 100%, 80%)`

const colorPicker = document.getElementById('color-picker') as HTMLInputElement
const colorHex = document.getElementById('color-hex') as HTMLSpanElement

colorPicker.addEventListener('input', function(e) {
    const event = e.target as HTMLInputElement
    document.documentElement.style.setProperty('--color', event.value)
})

const [h, s, l] = randomStartColor.slice(randomStartColor.indexOf('(') + 1, randomStartColor.indexOf(')')).replace(/%/gi, '').split(',').map((n) => Number(n))
const hex = hslToHex(h, s, l)
colorPicker.value = hex
colorHex.innerText = hex.toUpperCase()
document.documentElement.style.setProperty('--color', randomStartColor)

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

const urlSearchParams = new URLSearchParams(window.location.search)
const shareParam = urlSearchParams.get('share')

if (shareParam) {
    const shader = atob(decodeURIComponent(shareParam))
    editor.innerText = shader
    rebuild()
    acknowledge(true)
}

const shareButton = document.getElementById('share-button') as HTMLButtonElement
shareButton.addEventListener('click', async function() {
    const shader = editor.innerText
    const encodedShader = encodeURIComponent(btoa(shader))

    const url = new URL(window.location.href)
    url.searchParams.set('share', encodedShader)

    try {
        await navigator.clipboard.writeText(url.toString())
    } catch(e) {
        console.error('Failed to copy text to clipboard:', e)
    }
})

