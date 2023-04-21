require('dotenv').config()
const express = require("express")
const path = require('path')
const limit = require("express-rate-limit")
const { v4: uuidv4 } = require("uuid")
const { Configuration, OpenAIApi } = require("openai")

const app = express()
const PORT = process.env.PORT || 6006

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY })
const openai = new OpenAIApi(configuration)

const createPrompt = (prompt, shader) =>
`Given the current GLSL fragment shader code:
${shader}

Generate a new fragment shader or modify the existing one based on the following user description: "${prompt}". Use these specifications:
- Precision: "precision mediump float;".
- Output: Use gl_FragColor for the output.
- Uniforms: Declare these uniforms at the top of the shader ONLY if needed for the given user description:
    1. float u_time
    2. vec2 u_mouse
    3. vec2 u_resolution
- Input: varying vec2 fragCoord
- Main function: Provide a custom main function for the fragment shader based on the user description.

Ensure that any functions used in the shader code are fully defined within the code.
Do not add any explanation or text before or after the shader code. Do not include backticks (\`\`\`) in the response.`

const minifyShaderCode = (shaderCode) => 
    shaderCode.replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([\(\),\{\}])\s*/g, '$1')

const MAX_REQUESTS_PER_MINUTE = 10
const MAX_REQUESTS_PER_PERIOD = 100
const REQUESTS_PER_MINUTE_MS = 1 * 60 * 1000
const REQUESTS_PER_DAY_MS = 24 * 60 * 60 * 1000

const apiLimiter = limit({
    windowMs: REQUESTS_PER_MINUTE_MS,
    max: MAX_REQUESTS_PER_MINUTE,
    message: "Too many requests (max 10 per minute). Please try again later.",
})

const ipQuotas = new Map()

setInterval(() => {
    const now = Date.now();
    for (const [ip, quota] of ipQuotas.entries()) {
        if (quota.resetTime <= now) {
            ipQuotas.delete(ip);
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
        res.status(429).send("Quota exceeded (max 100 per day). Please try again later.")
    } else {
        quota.count += 1
        next()
    }
})

app.get("/api/ai", async (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    })

    const prompt = req.query['prompt']
    const shader = req.query['shader']

    const decodedShader = Buffer.from(decodeURIComponent(shader), 'base64').toString('utf-8')
  
    const completion = await openai.createChatCompletion(
        {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "Output in GLSL only"
                },
                {
                    role: "user",
                    content: createPrompt(prompt, minifyShaderCode(decodedShader)),
                }
            ],
            stream: true,
        },
        {
            responseType: "stream"
        }
    )
  
    completion.data.pipe(res)
})

app.use('*', (_, res) => res.sendStatus(404))

app.listen(PORT, () => {
    console.log(`listening on ${PORT}`)
})

module.exports = app
