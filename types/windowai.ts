export type ChatMessage = { 
    role: "system" | "user" | "assistant", 
    content: string 
}

export type Input =
  | {
      prompt: string
    }
  | {
      messages: ChatMessage[]
    }

export type Output =
  | {
      text: string
    }
  | {
      message: ChatMessage
    }