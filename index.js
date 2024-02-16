require('dotenv').config()
const express = require("express")
const path = require('path')
const limit = require("express-rate-limit")
const { v4: uuidv4 } = require("uuid")
const { OpenAI } = require("openai")

const app = express()
const PORT = process.env.PORT || 6006

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const systemMessages = [
    "Generate a new fragment shader or modify the existing one based on the user description.",
    "Output in GLSL only.",
    `Precision: "precision mediump float;"`,
    `Declare these uniforms at the top of the shader ONLY if needed for the given user description:
        1. float u_time
        2. vec2 u_mouse
        3. vec2 u_resolution`,
    "Input: varying vec2 fragCoord",
    "Main function: Provide a custom main function for the fragment shader based on the user description.",
    "Ensure that any functions used in the shader code are fully defined within the code.",
    "Do not add any explanation or text before or after the shader code. Do not include backticks (\`\`\`) in the response.",
]

const getShaderContext = (shader) => `Given the current GLSL fragment shader code: ${shader}`
const createPrompt = (prompt) => `Generate a new fragment shader based on this prompt: "${prompt}".`

const minifyShaderCode = (shaderCode) =>
    shaderCode.replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([\(\),\{\}])\s*/g, '$1')

const MAX_REQUESTS_PER_MINUTE = 10
const MAX_REQUESTS_PER_PERIOD = 512
const REQUESTS_PER_MINUTE_MS = 1 * 60 * 1000
const REQUESTS_PER_DAY_MS = 24 * 60 * 60 * 1000

const apiLimiter = limit({
    windowMs: REQUESTS_PER_MINUTE_MS,
    max: MAX_REQUESTS_PER_MINUTE,
    message: "Too many requests (max 10 per minute). Please try again later.",
})

const ipQuotas = new Map()

setInterval(() => {
    const now = Date.now()
    for (const [ip, quota] of ipQuotas.entries()) {
        if (quota.resetTime <= now) {
            ipQuotas.delete(ip)
        }
    }
}, REQUESTS_PER_DAY_MS)

app.use(express.static(path.join(__dirname, 'dist')))

app.get('/', (_, res) => {
    res.status(200).sendFile(path.join(__dirname, 'dist/index.html'))
})

app.use("/api/ai", apiLimiter)

app.use("/api/ai", (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const now = Date.now()
    let quota = ipQuotas.get(ip)

    if (!quota) {
        quota = { id: uuidv4(), count: 0, resetTime: now + REQUESTS_PER_DAY_MS }
        ipQuotas.set(ip, quota)
    }

    if (quota.resetTime <= now) {
        quota.count = 0
        quota.resetTime = now + REQUESTS_PER_DAY_MS
    }

    if (quota.count >= MAX_REQUESTS_PER_PERIOD) {
        const message = "Raie limit exceeded. Please try again later."

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        })

        res.write(`event: error\n`)
        res.write(`data: ${JSON.stringify({ status: 429, message })}\n\n`)
        res.end()
    } else {
        quota.count += 1
        next()
    }
})

app.get("/api/ai", async (req, res) => {
    const apiKey = req.query['apiKey']
    const prompt = req.query['prompt']
    const shader = req.query['shader']

    const decodedShader = Buffer.from(decodeURIComponent(shader), 'base64').toString('utf-8')

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    })

    try {
        const { chat } = !!apiKey ? new OpenAI({ apiKey }) : openai
        const completion = await chat.completions.create({
            model: "gpt-4",
            messages: [
                ...systemMessages.map((content) => ({
                    role: "system",
                    content
                })),
                {
                    role: "user",
                    content: getShaderContext(minifyShaderCode(decodedShader)) + '\n' + createPrompt(prompt),
                }
            ],
            stream: true,
        })

        req.on('close', () => {
            res.end()
        })

        for await (const data of completion) {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }

        res.write('event: stream-complete\ndata: {}\n\n');
        res.end();
    } catch (error) {
        const message = error.status === 429
            ? "Out of funds for OpenAI requests on current API key. Please use a different key or try again later."
            : error.message

        res.write(`event: error\n`)
        res.write(`data: ${JSON.stringify({ status: error.status, message })}\n\n`)
        res.end()
    }
})

app.use('*', (_, res) => res.sendStatus(404))

app.listen(PORT, () => {
    console.log(`listening on ${PORT}`)
})

module.exports = app

