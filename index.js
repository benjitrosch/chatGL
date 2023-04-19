const express = require("express")
const path = require('path')
const { Configuration, OpenAIApi } = require("openai")

const app = express()
const PORT = process.env.PORT || 8080

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY })
const openai = new OpenAIApi(configuration)

const createPrompt = (prompt, shader) =>
`Given the current GLSL fragment shader code:
${shader}

Generate a new fragment shader or modify the existing one based on the following user description: "${prompt}". Use these specifications:
- Version: GL ES 3.0.
- Version directive at the top: "#version 300 es".
- Precision: "precision mediump float;" after the version directive.
- Output: Declare the output as an out variable called "fragColor". (gl_FragColor is deprecated)
- Uniforms: Declare these uniforms at the top of the shader (use them if needed):
    1. float u_time
    2. vec2 u_mouse
    3. vec2 u_resolution
    4. sampler2D u_texture
- Input: in vec2 fragCoord
- Main function: Provide a custom main function for the fragment shader based on the user description.

Ensure that any functions used in the shader code are fully defined within the code.
Do not add any explanation or text before or after the shader code. Do not include backticks (\`\`\`) in the response.`

const minifyShaderCode = (shaderCode) => 
    shaderCode.replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([\(\),\{\}])\s*/g, '$1')

app.use(express.static(path.join(__dirname, 'dist')))

app.get('/', (_, res) => {
    res.status(200).sendFile(path.join(__dirname, 'dist/index.html'))
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
