import { Message } from '@/types/chat';
import { OpenAIModel } from '@/types/openai';
import {
  createParser,
  ParsedEvent,
  ReconnectInterval,
} from 'eventsource-parser';
import { OPENAI_API_HOST } from '../app/const';
// Here's the JavaScript API for the window.ai object that gets injected in every webpage:

// Get completions and chat reponses with this:
// async ai.getCompletion(
//     input: Input,
//     options: CompletionOptions = {}
//   ): Promise<Output>


// And get the user's current model like this (only in case you want to show in your UI):
// async getCurrentModel(): Promise<LLM>


// Putting the types in the thread
// alex — Today at 4:09 AM
// export type Input =
//   | {
//       prompt: string
//     }
//   | {
//       messages: ChatMessage[]
//     }

// export type Output =
//   | {
//       text: string
//     }
//   | {
//       message: ChatMessage
//     }


// interface CompletionOptions {
//   // If specified, partial updates will be streamed to this handler as they become available,
//   // and only the first partial update will be returned by the Promise.
//   onStreamResult?: (result: Output | null, error: string | null) => unknown
//   // What sampling temperature to use, between 0 and 2. Higher values like 0.8 will
//   // make the output more random, while lower values like 0.2 will make it more focused and deterministic.
//   // Different models have different defaults.
//   temperature?: number
//   // How many chat completion choices to generate for each input message. Defaults to 1.
//   // TODO n?: number
//   // The maximum number of tokens to generate in the chat completion. Defaults to infinity, but the
//   // total length of input tokens and generated tokens is limited by the model's context length.
//   maxTokens?: number
//   // Sequences where the API will stop generating further tokens.
//   stopSequences?: string[]
//   // Identifier of the model to use. Defaults to the user's current model, but can be overridden here.
//   model?: LLM
// }


enum LLM {
  GPT3 = "openai/gpt3.5",
  GPTNeo = "together/gpt-neoxt-20B",
  Cohere = "cohere/xlarge",
  Local = "local"
}
// alex — Today at 4:32 AM
// ChatMessage follows the OpenAI chatml format:  { role: “system” | “user” | “assistant”, content: string }
// alex
//  changed the channel name: 
// window.ai JavaScript API
//  — Today at 4:35 AM

// { role: “system” | “user” | “assistant”, content: string }
export type ChatMessage = {
  role: String,
  user: String,
  content: String
}
export type Output =
  | {
      text: string
    }
  | {
      message: ChatMessage
  }

interface CompletionOptions {
  // If specified, partial updates will be streamed to this handler as they become available,
  // and only the first partial update will be returned by the Promise.
  onStreamResult?: (result: Output | null, error: string | null) => unknown
  // What sampling temperature to use, between 0 and 2. Higher values like 0.8 will
  // make the output more random, while lower values like 0.2 will make it more focused and deterministic.
  // Different models have different defaults.
  temperature?: number
  // How many chat completion choices to generate for each input message. Defaults to 1.
  // TODO n?: number
  // The maximum number of tokens to generate in the chat completion. Defaults to infinity, but the
  // total length of input tokens and generated tokens is limited by the model's context length.
  maxTokens?: number
  // Sequences where the API will stop generating further tokens.
  stopSequences?: string[]
  // Identifier of the model to use. Defaults to the user's current model, but can be overridden here.
  model?: LLM
}

export const WindowAIStream = async (
  // model: LLM,
  systemPrompt: string,
  ai: any,
  messages: Message[],
) => {
  const options: CompletionOptions = {
    temperature: 1,
    maxTokens: 1000,
    onStreamResult: (result: Output | null, error: string | null) => {
      if (error) {
        console.error(error);
      } else if (result) {
        return  result;
      }
    },
  }; 
  const res = await ai.getCompletion(
    {
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ],
      options,
    },
  );

  // const encoder = new TextEncoder();
  // const decoder = new TextDecoder();
  if(res.status !== 200) {
    throw new Error("OpenAI Error");
  }
  const result = await res.json();
  return result;
};


export class OpenAIError extends Error {
  type: string;
  param: string;
  code: string;

  constructor(message: string, type: string, param: string, code: string) {
    super(message);
    this.name = 'OpenAIError';
    this.type = type;
    this.param = param;
    this.code = code;
  }
}

export const OpenAIStream = async (
  model: OpenAIModel,
  systemPrompt: string,
  key: string,
  messages: Message[],
) => {

  const res = await fetch(`${OPENAI_API_HOST}/v1/chat/completions`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key ? key : process.env.OPENAI_API_KEY}`,
      ...(process.env.OPENAI_ORGANIZATION && {
        'OpenAI-Organization': process.env.OPENAI_ORGANIZATION,
      }),
    },
    method: 'POST',
    body: JSON.stringify({
      model: model.id,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ],
      max_tokens: 1000,
      temperature: 1,
      stream: true,
    }),
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  if (res.status !== 200) {
    const result = await res.json();
    if (result.error) {
      throw new OpenAIError(
        result.error.message,
        result.error.type,
        result.error.param,
        result.error.code,
      );
    } else {
      throw new Error(
        `OpenAI API returned an error: ${
          decoder.decode(result?.value) || result.statusText
        }`,
      );
    }

  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data;

          if (data === '[DONE]') {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};
