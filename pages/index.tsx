import { Chat } from '@/components/Chat/Chat';
import { Chatbar } from '@/components/Chatbar/Chatbar';
import { Navbar } from '@/components/Mobile/Navbar';
import { Promptbar } from '@/components/Promptbar/Promptbar';
import WindowNotInstalled from '@/components/Modals/WindowNotInstalled';

import { ChatBody, Conversation, Message, WindowChatBody } from '@/types/chat';
import { KeyValuePair } from '@/types/data';
import { ErrorMessage } from '@/types/error';
import { LatestExportFormat, SupportedExportFormats } from '@/types/export';
import { Folder, FolderType } from '@/types/folder';
import {
  fallbackModelID,
  OpenAIModel,
  OpenAIModelID,
  OpenAIModels,
} from '@/types/openai';
import { Prompt } from '@/types/prompt';
import {
  cleanConversationHistory,
  cleanSelectedConversation,
} from '@/utils/app/clean';
import { DEFAULT_SYSTEM_PROMPT } from '@/utils/app/const';
import {
  saveConversation,
  saveConversations,
  updateConversation,
} from '@/utils/app/conversation';
import { saveFolders } from '@/utils/app/folders';
import { exportData, importData } from '@/utils/app/importExport';
import { savePrompts } from '@/utils/app/prompts';
import { IconArrowBarLeft, IconArrowBarRight } from '@tabler/icons-react';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
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
  GPT4 = "openai/gpt4",
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

interface HomeProps {
  serverSideApiKeyIsSet: boolean;
  defaultModelId: OpenAIModelID;
}
const Home: React.FC<HomeProps> = ({
  serverSideApiKeyIsSet,
  defaultModelId,
}) => {
  //useEffect

  // useEffect(() => {
  //   (async () => {
  //     if( !(window as any).ai ) return;
  //     //messages
  //     let result = await (window as any).ai.getCompletion(
  //       {
  //         messages: [
  //           { role: 'system', content: 'You are a helpful assistant.' },
  //           { role: 'user', content: 'Hello' },
  //         ],
  //       },
  //     );
  //     console.log(result);
  //   })()
  // }, [])

  const { t } = useTranslation('chat');

  // STATE ----------------------------------------------

  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [timer, setTimer] = useState<any>();
  const [windowIsInstalled, setWindowIsInstalled] = useState<boolean>(false);
  const [streamIsDone, setStreamIsDone] = useState<boolean>(false);
  const [lightMode, setLightMode] = useState<'dark' | 'light'>('dark');
  const [messageIsStreaming, setMessageIsStreaming] = useState<boolean>(false);

  const [modelError, setModelError] = useState<ErrorMessage | null>(null);

  const [models, setModels] = useState<OpenAIModel[]>([]);

  const [folders, setFolders] = useState<Folder[]>([]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation>();
  const [currentMessage, setCurrentMessage] = useState<Message>();

  const [showSidebar, setShowSidebar] = useState<boolean>(true);

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [showPromptbar, setShowPromptbar] = useState<boolean>(true);

  // REFS ----------------------------------------------

  const stopConversationRef = useRef<boolean>(false);

  // FETCH RESPONSE ----------------------------------------------

  const handleSend = async (message: Message, deleteCount = 0) => {
    if (selectedConversation) {
      let updatedConversation: Conversation;

      if (deleteCount) {
        const updatedMessages = [...selectedConversation.messages];
        for (let i = 0; i < deleteCount; i++) {
          updatedMessages.pop();
        }

        updatedConversation = {
          ...selectedConversation,
          messages: [...updatedMessages, message],
        };
      } else {
        updatedConversation = {
          ...selectedConversation,
          messages: [...selectedConversation.messages, message],
        };
      }

      setSelectedConversation(updatedConversation);
      setLoading(true);
      setMessageIsStreaming(true);

      // const chatBody: ChatBody = {
      //   model: updatedConversation.model,
      //   messages: updatedConversation.messages,
      //   key: apiKey,
      //   prompt: updatedConversation.prompt,
      // };
      interface WindowAICompletionOptions {
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
      enum LLM {
        GPT3 = "openai/gpt3.5",
        GPT4 = "openai/gpt4",
        GPTNeo = "together/gpt-neoxt-20B",
        Cohere = "cohere/xlarge",
        Local = "local"
      }
      type ChatMessage = {
        role: String,
        user: String,
        content: String
      }
      type Output = | {
            text: string
          } | {
            message: ChatMessage
        }

      const options: WindowAICompletionOptions = {
        temperature: 1,
        maxTokens: 1000,
        onStreamResult: (result: Output | null, error: string | null) => {
          if (error) {
            console.error(error);
            setLoading(false);
          } else if (result) {
            setLoading(false);
            //timer logic
            if(timer) clearTimeout(timer);
            setTimer(setTimeout(() => {
              setMessageIsStreaming(false);
            }, 1500));

            //get the last message
            console.log(result)
            const lastMessage = updatedConversation.messages[
              updatedConversation.messages.length - 1
            ];
            if(lastMessage.role === 'user') {
              setLoading(false)
              //if the last message is a user, add the result as a system message
              updatedConversation.messages = [
                ...updatedConversation.messages,
                {
                  role: 'assistant',
                  content: (result as any).message.content,
                },
              ];
            } else {
              //if the last message is a system message, add the result to the last message
              const updatedMessages: Message[] = updatedConversation.messages.map(
                (message, index) => {
                  if (index === updatedConversation.messages.length - 1) {
                    // if the message is the last message is a user 
                    return {
                      ...message,
                      //we didn't know why this wasn't working :( don't flame us
                      content: message.content + (result as any).message.content,
                    };
                  }
                  return message;
                }
              );
              updatedConversation = {
                      ...updatedConversation,
                      messages: updatedMessages,
                    };
            }
            
            setSelectedConversation(updatedConversation);
          }
        },
      }; 
    

      // const chatBody: ChatBody = {
      //   model: updatedConversation.model,
      //   messages: updatedConversation.messages,
      //   key: apiKey,
      //   prompt: updatedConversation.prompt,
      // };
      // const controller = new AbortController();
      // console.log({
      //   messages: [
      //     {
      //       role: 'system',
      //       content: updatedConversation.prompt,
      //     },
      //     ...updatedConversation.messages,
      //   ],
      //   options,
      // },)
      if( !(window as any).ai ) return;
      console.log(updatedConversation.prompt)
      console.log(updatedConversation.messages)
      try {
        //will throw if user denies request from window.ai
        const response = await (window as any).ai.getCompletion(
          {
            messages: [
              {
                role: 'system',
                content: updatedConversation.prompt,
              },
              ...updatedConversation.messages,
            ],
          },
          options
        );
        console.log(response)
        // TEMPORARY UNTIL STREAMING IS FIXED
      } catch (e) {
        console.error(e)
      }
      // const response = await fetch('/api/chat', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   signal: controller.signal,
      //   body: JSON.stringify(chatBody),
      // });

      // if (!response.ok) {
      //   setLoading(false);
      //   setMessageIsStreaming(false);
      //   toast.error(response.statusText);
      //   return;
      // }

      // const data = response.body;

      // if (!data) {
      //   setLoading(false);
      //   setMessageIsStreaming(false);
      //   return;
      // }

      if (updatedConversation.messages.length === 1) {
        const { content } = message;
        const customName =
          content.length > 30 ? content.substring(0, 30) + '...' : content;

        updatedConversation = {
          ...updatedConversation,
          name: customName,
        };
      }

      // setLoading(false);

      // const reader = data.getReader();
      // const decoder = new TextDecoder();
      // let done = false;
      // let isFirst = true;
      // let text = '';

      // while (!done) {
      //   if (stopConversationRef.current === true) {
      //     controller.abort();
      //     done = true;
      //     break;
      //   }
      //   const { value, done: doneReading } = await reader.read();
      //   done = doneReading;
      //   const chunkValue = decoder.decode(value);

      //   text += chunkValue;

      //   if (isFirst) {
      //     isFirst = false;
      //     const updatedMessages: Message[] = [
      //       ...updatedConversation.messages,
      //       { role: 'assistant', content: chunkValue },
      //     ];

      //     updatedConversation = {
      //       ...updatedConversation,
      //       messages: updatedMessages,
      //     };

      //     setSelectedConversation(updatedConversation);
      //   } else {
      //     const updatedMessages: Message[] = updatedConversation.messages.map(
      //       (message, index) => {
      //         if (index === updatedConversation.messages.length - 1) {
      //           return {
      //             ...message,
      //             content: text,
      //           };
      //         }

      //         return message;
      //       },
      //     );

      //     updatedConversation = {
      //       ...updatedConversation,
      //       messages: updatedMessages,
      //     };

      //     setSelectedConversation(updatedConversation);
      //   }
      // }
    }
  };

  // FETCH MODELS ----------------------------------------------

  // export interface OpenAIModel {
  //   id: string;
  //   name: string;
  //   maxLength: number; // maximum length of a message
  //   tokenLimit: number;
  // }
  
  const LLMToOpenAIModel = {
    [LLM.GPT3]: {
      id: "gpt-3.5-turbo",
      name: "GPT-3.5",
      maxLength: 12000,
      tokenLimit: 3000,
    },
    [LLM.GPT4]: {
      id: "gpt-4",
      name: "GPT-4",
      maxLength: 12000,
      tokenLimit: 3000,
    },
    [LLM.GPTNeo]: {
      id: "gpt-neo-2.7B",
      name: "GPT-Neo",
      maxLength: 12000,
      tokenLimit: 3000,
    },
    [LLM.Cohere]: {
      id: "cohere",
      name: "Cohere",
      maxLength: 12000,
      tokenLimit: 3000,
    },
    [LLM.Local]: {
      id: "local",
      name: "Local",
      maxLength: 12000,
      tokenLimit: 3000,
    },
  }
  const fetchModels = async () => {
    let model: LLM = await (window as any).ai.getCurrentModel();
    setModels([
      LLMToOpenAIModel[model]
    ]);
    //TODO: change MaxLength and tokenLimit to be dynamic
    setModelError(null);
  };

  // BASIC HANDLERS --------------------------------------------

  const handleLightMode = (mode: 'dark' | 'light') => {
    setLightMode(mode);
    localStorage.setItem('theme', mode);
  };

  const handleApiKeyChange = (apiKey: string) => {
    setApiKey(apiKey);
    localStorage.setItem('apiKey', apiKey);
  };

  const handleToggleChatbar = () => {
    setShowSidebar(!showSidebar);
    localStorage.setItem('showChatbar', JSON.stringify(!showSidebar));
  };

  const handleTogglePromptbar = () => {
    setShowPromptbar(!showPromptbar);
    localStorage.setItem('showPromptbar', JSON.stringify(!showPromptbar));
  };

  const handleExportData = () => {
    exportData();
  };

  const handleImportConversations = (data: SupportedExportFormats) => {
    const { history, folders, prompts }: LatestExportFormat = importData(data);

    setConversations(history);
    setSelectedConversation(history[history.length - 1]);
    setFolders(folders);
    setPrompts(prompts);
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    saveConversation(conversation);
  };

  // FOLDER OPERATIONS  --------------------------------------------

  const handleCreateFolder = (name: string, type: FolderType) => {
    const newFolder: Folder = {
      id: uuidv4(),
      name,
      type,
    };

    const updatedFolders = [...folders, newFolder];

    setFolders(updatedFolders);
    saveFolders(updatedFolders);
  };

  const handleDeleteFolder = (folderId: string) => {
    const updatedFolders = folders.filter((f) => f.id !== folderId);
    setFolders(updatedFolders);
    saveFolders(updatedFolders);

    const updatedConversations: Conversation[] = conversations.map((c) => {
      if (c.folderId === folderId) {
        return {
          ...c,
          folderId: null,
        };
      }

      return c;
    });
    setConversations(updatedConversations);
    saveConversations(updatedConversations);

    const updatedPrompts: Prompt[] = prompts.map((p) => {
      if (p.folderId === folderId) {
        return {
          ...p,
          folderId: null,
        };
      }

      return p;
    });
    setPrompts(updatedPrompts);
    savePrompts(updatedPrompts);
  };

  const handleUpdateFolder = (folderId: string, name: string) => {
    const updatedFolders = folders.map((f) => {
      if (f.id === folderId) {
        return {
          ...f,
          name,
        };
      }

      return f;
    });

    setFolders(updatedFolders);
    saveFolders(updatedFolders);
  };

  // CONVERSATION OPERATIONS  --------------------------------------------

  const handleNewConversation = () => {
    const lastConversation = conversations[conversations.length - 1];

    const newConversation: Conversation = {
      id: uuidv4(),
      name: `${t('New Conversation')}`,
      messages: [],
      model: lastConversation?.model || {
        id: OpenAIModels[defaultModelId].id,
        name: OpenAIModels[defaultModelId].name,
        maxLength: OpenAIModels[defaultModelId].maxLength,
        tokenLimit: OpenAIModels[defaultModelId].tokenLimit,
      },
      prompt: DEFAULT_SYSTEM_PROMPT,
      folderId: null,
    };

    const updatedConversations = [...conversations, newConversation];

    setSelectedConversation(newConversation);
    setConversations(updatedConversations);

    saveConversation(newConversation);
    saveConversations(updatedConversations);

    setLoading(false);
  };

  const handleDeleteConversation = (conversation: Conversation) => {
    const updatedConversations = conversations.filter(
      (c) => c.id !== conversation.id,
    );
    setConversations(updatedConversations);
    saveConversations(updatedConversations);

    if (updatedConversations.length > 0) {
      setSelectedConversation(
        updatedConversations[updatedConversations.length - 1],
      );
      saveConversation(updatedConversations[updatedConversations.length - 1]);
    } else {
      setSelectedConversation({
        id: uuidv4(),
        name: 'New conversation',
        messages: [],
        model: OpenAIModels[defaultModelId],
        prompt: DEFAULT_SYSTEM_PROMPT,
        folderId: null,
      });
      localStorage.removeItem('selectedConversation');
    }
  };

  const handleUpdateConversation = (
    conversation: Conversation,
    data: KeyValuePair,
  ) => {
    const updatedConversation = {
      ...conversation,
      [data.key]: data.value,
    };

    const { single, all } = updateConversation(
      updatedConversation,
      conversations,
    );

    setSelectedConversation(single);
    setConversations(all);
  };

  const handleClearConversations = () => {
    setConversations([]);
    localStorage.removeItem('conversationHistory');

    setSelectedConversation({
      id: uuidv4(),
      name: 'New conversation',
      messages: [],
      model: OpenAIModels[defaultModelId],
      prompt: DEFAULT_SYSTEM_PROMPT,
      folderId: null,
    });
    localStorage.removeItem('selectedConversation');

    const updatedFolders = folders.filter((f) => f.type !== 'chat');
    setFolders(updatedFolders);
    saveFolders(updatedFolders);
  };

  const handleEditMessage = (message: Message, messageIndex: number) => {
    if (selectedConversation) {
      const updatedMessages = selectedConversation.messages
        .map((m, i) => {
          if (i < messageIndex) {
            return m;
          }
        })
        .filter((m) => m) as Message[];

      const updatedConversation = {
        ...selectedConversation,
        messages: updatedMessages,
      };

      const { single, all } = updateConversation(
        updatedConversation,
        conversations,
      );

      setSelectedConversation(single);
      setConversations(all);

      setCurrentMessage(message);
    }
  };

  // PROMPT OPERATIONS --------------------------------------------

  const handleCreatePrompt = () => {
    const lastPrompt = prompts[prompts.length - 1];

    const newPrompt: Prompt = {
      id: uuidv4(),
      name: `Prompt ${prompts.length + 1}`,
      description: '',
      content: '',
      model: OpenAIModels[defaultModelId],
      folderId: null,
    };

    const updatedPrompts = [...prompts, newPrompt];

    setPrompts(updatedPrompts);
    savePrompts(updatedPrompts);
  };

  const handleUpdatePrompt = (prompt: Prompt) => {
    const updatedPrompts = prompts.map((p) => {
      if (p.id === prompt.id) {
        return prompt;
      }

      return p;
    });

    setPrompts(updatedPrompts);
    savePrompts(updatedPrompts);
  };

  const handleDeletePrompt = (prompt: Prompt) => {
    const updatedPrompts = prompts.filter((p) => p.id !== prompt.id);
    setPrompts(updatedPrompts);
    savePrompts(updatedPrompts);
  };

  // EFFECTS  --------------------------------------------

  useEffect(() => {
    if (currentMessage) {
      handleSend(currentMessage);
      setCurrentMessage(undefined);
    }
  }, [currentMessage]);

  useEffect(() => {
    if (window.innerWidth < 640) {
      setShowSidebar(false);
    }
  }, [selectedConversation]);

  useEffect(() => {
    if ((window as any).ai) {
      setWindowIsInstalled(true);
      fetchModels();
    }
    const interval = setInterval(() => {
      if ((window as any).ai) {
        setWindowIsInstalled(true);
        fetchModels();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ON LOAD --------------------------------------------

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme) {
      setLightMode(theme as 'dark' | 'light');
    }

    const apiKey = localStorage.getItem('apiKey');
    if ((window as any)?.ai) {
      fetchModels();
    }

    if (window.innerWidth < 640) {
      setShowSidebar(false);
    }

    const showChatbar = localStorage.getItem('showChatbar');
    if (showChatbar) {
      setShowSidebar(showChatbar === 'true');
    }

    const showPromptbar = localStorage.getItem('showPromptbar');
    if (showPromptbar) {
      setShowPromptbar(showPromptbar === 'true');
    }

    const folders = localStorage.getItem('folders');
    if (folders) {
      setFolders(JSON.parse(folders));
    }

    const prompts = localStorage.getItem('prompts');
    if (prompts) {
      setPrompts(JSON.parse(prompts));
    }

    const conversationHistory = localStorage.getItem('conversationHistory');
    if (conversationHistory) {
      const parsedConversationHistory: Conversation[] =
        JSON.parse(conversationHistory);
      const cleanedConversationHistory = cleanConversationHistory(
        parsedConversationHistory,
      );
      setConversations(cleanedConversationHistory);
    }

    const selectedConversation = localStorage.getItem('selectedConversation');
    if (selectedConversation) {
      const parsedSelectedConversation: Conversation =
        JSON.parse(selectedConversation);
      const cleanedSelectedConversation = cleanSelectedConversation(
        parsedSelectedConversation,
      );
      setSelectedConversation(cleanedSelectedConversation);
    } else {
      setSelectedConversation({
        id: uuidv4(),
        name: 'New conversation',
        messages: [],
        model: OpenAIModels[defaultModelId],
        prompt: DEFAULT_SYSTEM_PROMPT,
        folderId: null,
      });
    }
  }, [serverSideApiKeyIsSet]);

  return (
    <>
      {!windowIsInstalled && <WindowNotInstalled />}
      <Head>
        <title>Chatbot UI with WindowAI</title>
        <meta name="description" content="ChatGPT but better." />
        <meta
          name="viewport"
          content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {selectedConversation && (
        <main
          className={`flex h-screen w-screen flex-col text-sm text-white dark:text-white ${lightMode}`}
        >
          <div className="fixed top-0 w-full sm:hidden">
            <Navbar
              selectedConversation={selectedConversation}
              onNewConversation={handleNewConversation}
            />
          </div>
          <div className="hidden sm:flex w-full bg-gray-700 tracking-wide text-white font-thin justify-center">
              Built&nbsp;with&nbsp;❤️&nbsp;by&nbsp;
              <a className="hover:underline" href="https://twitter.com/jcllobet" target="_blank">Jan</a>,&nbsp;
              <a className="hover:underline" href="https://twitter.com/chemocheese" target="_blank">Jonny</a>,&nbsp;
              <a className="hover:underline" href="https://twitter.com/nolangclement" target="_blank">Nolan</a>, 
              and&nbsp;
              <a className="hover:underline" href="https://twitter.com/ykouloumbis" target="_blank">Yanni</a>.
          </div>

          <div className="flex h-full w-full pt-[48px] sm:pt-0">
            {showSidebar ? (
              <div>
                <Chatbar
                  loading={messageIsStreaming}
                  conversations={conversations}
                  lightMode={lightMode}
                  selectedConversation={selectedConversation}
                  apiKey={apiKey}
                  folders={folders.filter((folder) => folder.type === 'chat')}
                  onToggleLightMode={handleLightMode}
                  onCreateFolder={(name) => handleCreateFolder(name, 'chat')}
                  onDeleteFolder={handleDeleteFolder}
                  onUpdateFolder={handleUpdateFolder}
                  onNewConversation={handleNewConversation}
                  onSelectConversation={handleSelectConversation}
                  onDeleteConversation={handleDeleteConversation}
                  onUpdateConversation={handleUpdateConversation}
                  onApiKeyChange={handleApiKeyChange}
                  onClearConversations={handleClearConversations}
                  onExportConversations={handleExportData}
                  onImportConversations={handleImportConversations}
                />

                <button
                  className="fixed top-5 left-[270px] z-50 h-7 w-7 hover:text-gray-400 dark:text-white dark:hover:text-gray-300 sm:top-5 sm:left-[270px] sm:h-8 sm:w-8 sm:text-neutral-700"
                  onClick={handleToggleChatbar}
                >
                  <IconArrowBarLeft />
                </button>
                <div
                  onClick={handleToggleChatbar}
                  className="absolute top-0 left-0 z-10 h-full w-full bg-black opacity-70 sm:hidden"
                ></div>
              </div>
            ) : (
              <button
                className="fixed top-2.5 left-4 z-50 h-7 w-7 text-white hover:text-gray-400 dark:text-white dark:hover:text-gray-300 sm:top-5 sm:left-4 sm:h-8 sm:w-8 sm:text-neutral-700"
                onClick={handleToggleChatbar}
              >
                <IconArrowBarRight />
              </button>
            )}

            <div className="flex flex-1">
              <Chat
                conversation={selectedConversation}
                messageIsStreaming={messageIsStreaming}
                apiKey={apiKey}
                serverSideApiKeyIsSet={true}
                defaultModelId={defaultModelId}
                modelError={modelError}
                models={models}
                loading={loading}
                prompts={prompts}
                onSend={handleSend}
                onUpdateConversation={handleUpdateConversation}
                onEditMessage={handleEditMessage}
                stopConversationRef={stopConversationRef}
              />
            </div>

            {showPromptbar ? (
              <div>
                <Promptbar
                  prompts={prompts}
                  folders={folders.filter((folder) => folder.type === 'prompt')}
                  onCreatePrompt={handleCreatePrompt}
                  onUpdatePrompt={handleUpdatePrompt}
                  onDeletePrompt={handleDeletePrompt}
                  onCreateFolder={(name) => handleCreateFolder(name, 'prompt')}
                  onDeleteFolder={handleDeleteFolder}
                  onUpdateFolder={handleUpdateFolder}
                />
                <button
                  className="fixed top-5 right-[270px] z-50 h-7 w-7 hover:text-gray-400 dark:text-white dark:hover:text-gray-300 sm:top-5 sm:right-[270px] sm:h-8 sm:w-8 sm:text-neutral-700"
                  onClick={handleTogglePromptbar}
                >
                  <IconArrowBarRight />
                </button>
                <div
                  onClick={handleTogglePromptbar}
                  className="absolute top-0 left-0 z-10 h-full w-full bg-black opacity-70 sm:hidden"
                ></div>
              </div>
            ) : (
              <button
                className="fixed top-2.5 right-4 z-50 h-7 w-7 text-white hover:text-gray-400 dark:text-white dark:hover:text-gray-300 sm:top-5 sm:right-4 sm:h-8 sm:w-8 sm:text-neutral-700"
                onClick={handleTogglePromptbar}
              >
                <IconArrowBarLeft />
              </button>
            )}
          </div>
        </main>
      )}
    </>
  );
};
export default Home;

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
  const defaultModelId =
    (process.env.DEFAULT_MODEL &&
      Object.values(OpenAIModelID).includes(
        process.env.DEFAULT_MODEL as OpenAIModelID,
      ) &&
      process.env.DEFAULT_MODEL) ||
    fallbackModelID;

  return {
    props: {
      serverSideApiKeyIsSet: !!process.env.OPENAI_API_KEY,
      defaultModelId,
      ...(await serverSideTranslations(locale ?? 'en', [
        'common',
        'chat',
        'sidebar',
        'markdown',
        'promptbar',
      ])),
    },
  };
};
