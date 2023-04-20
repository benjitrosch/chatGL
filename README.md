# chatGL

GLSL fragment shader generator using `gpt-3.5-turbo` wrapped in a fast Vanilla Typescript + Vite frontend.

> NOTE: The prompts are meant to produce interesting pseudo-random generative art using fragment shaders, not to build anything precise. You're just as well off using a totally random prompt as you are a guided one.

## Quick Start

1. Generate an openAI API key - https://platform.openai.com/account/api-keys
2. Create an `.env` file and put your key in `OPENAI_API_KEY`
3. Run `npm run build` to build the frontend and `npm start` to start the server
4. Visit http://localhost:6006

\- or -

1. Visit https://chatgl.ai

## Acknowledgements

* [Harley Turan](https://twitter.com/hturan/status/1638230938080485376) using GPT-4 for MIDI-controllable shaders
* [Jordan Scales](https://github.com/jdan/deepdive) using the [EventSource browser API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) to stream AI response
* [Ben Follington](https://github.com/bfollington/) for inspiring the user interface
---

### License

This project is licensed under the MIT License - see the [LICENSE.md](https://github.com/benjitrosch/chatGL/blob/main/LICENSE) file for details.