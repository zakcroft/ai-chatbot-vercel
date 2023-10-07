import { kv } from '@vercel/kv'
import { OpenAIStream, StreamingTextResponse } from 'ai'
import { Configuration, OpenAIApi } from 'openai-edge'
const axios = require('axios')
import { auth } from '@/auth'
import { nanoid } from '@/lib/utils'
import {
  ChatPromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate
} from 'langchain/prompts'
import { AIMessage, HumanMessage, SystemMessage } from 'langchain/schema'
import { instructionsPrompt } from '../../prompts/instructionsPrompt'
import { formatPrompt } from '@/app/utils/formatPrompt'

// export const runtime = 'edge'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})

const openai = new OpenAIApi(configuration)

const postRetrieval = async (messages: [{ role: string; content: string }]) => {
  console.log('postRetrieval')
  try {
    const response = await axios.post('http://0.0.0.0:80/query', {
      user_id: '1234567',
      conversation_id: '47465645674765',
      query: 'hello',
      is_quick_action: true,
      with_retrieval: false,
      request_id: '12345678'
    })

    // console.log(response.data)
    // const otherServiceData = response.dataJSON.parse(response).log
    return response.data.results.nodes

    // Use otherServiceData as needed
  } catch (error) {
    console.error('Error calling other service:', error)
  }
}

export async function POST(req: Request) {
  const json = await req.json()
  const { messages, previewToken } = json
  const userId = (await auth())?.user.id

  const context = await postRetrieval(messages)
  console.log('messages', messages)
  // console.log('context', context)

  if (!userId) {
    return new Response('Unauthorized', {
      status: 401
    })
  }

  if (previewToken) {
    configuration.apiKey = previewToken
  }

  const formattedPrompt = formatPrompt(instructionsPrompt, [context])

  // console.log('formattedPrompt', formattedPrompt)

  const compiledMessages = [
    { role: 'system', content: formattedPrompt },
    ...messages
  ]

  // console.log('compiledMessages', compiledMessages)

  const res = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: compiledMessages,
    temperature: 0.7,
    stream: true
  })

  const stream = OpenAIStream(res, {
    async onCompletion(completion) {
      const title = json.messages[0].content.substring(0, 100)
      const id = json.id ?? nanoid()
      const createdAt = Date.now()
      const path = `/chat/${id}`
      const payload = {
        id,
        title,
        userId,
        createdAt,
        path,
        messages: [
          ...messages,
          {
            content: completion,
            role: 'assistant'
          }
        ]
      }
      // await kv.hmset(`chat:${id}`, payload)
      // await kv.zadd(`user:chat:${userId}`, {
      //   score: createdAt,
      //   member: `chat:${id}`
      // })
    }
  })

  return new StreamingTextResponse(stream)
}
