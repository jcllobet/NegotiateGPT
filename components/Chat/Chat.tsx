import { Conversation, Message } from '@/types/chat';
import { KeyValuePair } from '@/types/data';
import { ErrorMessage } from '@/types/error';
import { OpenAIModel, OpenAIModelID } from '@/types/openai';
import { Prompt } from '@/types/prompt';
import { throttle } from '@/utils';
import { IconArrowDown, IconClearAll, IconSettings } from '@tabler/icons-react';
import Image from 'next/image';
import { useTranslation } from 'next-i18next';
import {
  FC,
  memo,
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Spinner } from '../Global/Spinner';
import { ChatInput } from './ChatInput';
import { ChatLoader } from './ChatLoader';
import { ChatMessage } from './ChatMessage';
import { ErrorMessageDiv } from './ErrorMessageDiv';
import { ModelSelect } from './ModelSelect';
import { SystemPrompt } from './SystemPrompt';

interface Props {
  conversation: Conversation;
  models: OpenAIModel[];
  apiKey: string;
  serverSideApiKeyIsSet: boolean;
  defaultModelId: OpenAIModelID;
  messageIsStreaming: boolean;
  modelError: ErrorMessage | null;
  loading: boolean;
  prompts: Prompt[];
  onSend: (message: Message, deleteCount?: number) => void;
  onUpdateConversation: (
    conversation: Conversation,
    data: KeyValuePair,
  ) => void;
  onEditMessage: (message: Message, messageIndex: number) => void;
  stopConversationRef: MutableRefObject<boolean>;
}

export const Chat: FC<Props> = memo(
  ({
    conversation,
    models,
    apiKey,
    serverSideApiKeyIsSet,
    defaultModelId,
    messageIsStreaming,
    modelError,
    loading,
    prompts,
    onSend,
    onUpdateConversation,
    onEditMessage,
    stopConversationRef,
  }) => {
    const { t } = useTranslation('chat');
    const [currentMessage, setCurrentMessage] = useState<Message>();
    const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
    const [showSettings, setShowSettings] = useState<boolean>(false);
    const [showScrollDownButton, setShowScrollDownButton] =
      useState<boolean>(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = useCallback(() => {
      if (autoScrollEnabled) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        textareaRef.current?.focus();
      }
    }, [autoScrollEnabled]);

    const handleScroll = () => {
      if (chatContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } =
          chatContainerRef.current;
        const bottomTolerance = 30;

        if (scrollTop + clientHeight < scrollHeight - bottomTolerance) {
          setAutoScrollEnabled(false);
          setShowScrollDownButton(true);
        } else {
          setAutoScrollEnabled(true);
          setShowScrollDownButton(false);
        }
      }
    };

    const handleScrollDown = () => {
      chatContainerRef.current?.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    };

    const handleSettings = () => {
      setShowSettings(!showSettings);
    };

    const onClearAll = () => {
      if (confirm(t<string>('Are you sure you want to clear all messages?'))) {
        onUpdateConversation(conversation, { key: 'messages', value: [] });
      }
    };

    const scrollDown = () => {
      if (autoScrollEnabled) {
        messagesEndRef.current?.scrollIntoView(true);
      }
    };
    const throttledScrollDown = throttle(scrollDown, 250);

    // appear scroll down button only when user scrolls up

    useEffect(() => {
      throttledScrollDown();
      setCurrentMessage(
        conversation.messages[conversation.messages.length - 2],
      );
    }, [conversation.messages, throttledScrollDown]);

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          setAutoScrollEnabled(entry.isIntersecting);
          if (entry.isIntersecting) {
            textareaRef.current?.focus();
          }
        },
        {
          root: null,
          threshold: 0.5,
        },
      );
      const messagesEndElement = messagesEndRef.current;
      if (messagesEndElement) {
        observer.observe(messagesEndElement);
      }
      return () => {
        if (messagesEndElement) {
          observer.unobserve(messagesEndElement);
        }
      };
    }, [messagesEndRef]);

    return (
      <div className="relative flex-1 overflow-hidden bg-white dark:bg-[#343541]">
        {/* Check if API key is set, if not show a welcome message */}
        {!(apiKey || serverSideApiKeyIsSet) ? (
          <div className="mx-auto flex h-full w-[300px] flex-col justify-center space-y-6 sm:w-[600px]">
            {/* Display welcome message */}
            <div className="text-center text-4xl font-bold text-black dark:text-white">
              Welcome to NegotiateGPT
            </div>
            {/* Display information about Chatbot UI */}
            <div className="text-center text-lg text-black dark:text-white">
              <div className="mb-8">{`Chatbot UI is an open source clone of OpenAI's ChatGPT UI.`}</div>
              <div className="mb-2 font-bold">
                Important: NegotiateGPT is 100% unaffiliated with OpenAI.
              </div>
            </div>
            {/* Display instructions for setting API key */}
            <div className="text-center text-gray-500 dark:text-gray-400">
              <div className="mb-2">
                NegotiateGPT allows you to plug in your API key to use via WindowAI.
              </div>
              <div className="mb-2">
                It is <span className="italic">only</span> used to communicate
                with their API.
              </div>
              <div className="mb-2">
                {t(
                  'Please set your OpenAI API key in the bottom left of the sidebar.',
                )}
              </div>
              <div>
                {t(
                  "If you don't have an OpenAI API key, you can get one here: ",
                )}
                <a
                  href="https://platform.openai.com/account/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  openai.com
                </a>
              </div>
            </div>
          </div>
        ) : modelError ? (
          <ErrorMessageDiv error={modelError} />
        ) : (
          <>
            {/* Chat container */}
            <div
              className="max-h-full overflow-x-hidden"
              ref={chatContainerRef}
              onScroll={handleScroll}
            >
              {/* Check if conversation has started */}
              {conversation.messages.length === 0 ? (
                <>
                  <div className="mx-auto flex w-[350px] flex-col space-y-10 pt-12 sm:w-[600px]">
                    {/* Display NegotiateGPT title */}
                    <div className="text-center text-3xl font-semibold text-gray-800 dark:text-gray-100">
                      {models.length === 0 ? (
                        <div>
                          <Spinner size="16px" className="mx-auto" />
                        </div>
                      ) : (
                        'NegotiateGPT 💼'
                      )}
                    </div>
                    {/* Display image between title and description */}
                    <div className="flex justify-center items-center">
                      <div className="w-full max-w-md mx-auto mt-4 mb-4 rounded-md overflow-hidden">
                        <Image
                          src="https://i.imgflip.com/3f9g1o.jpg?a466440"
                          alt="NegotiateGPT"
                          layout="responsive"
                          width={640}
                          height={480}
                          objectFit="cover"
                        />
                      </div>
                    </div>
                    {/* Display description of NegotiateGPT */}
                    <div className="text-justify text-lg text-gray-500 dark:text-gray-400">
                      <div className="mb-2">
                        It is interview season and you want to practice the final salary discussion 🤝. 
                        Here you can practice a 🔑 conversation by simulating your negotiation environment.
                      </div>
                    </div>
    
                    {/* Display model and prompt selection */}
                    {models.length > 0 && (
                      <div className="flex h-full flex-col space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-600">
                        <ModelSelect
                          model={conversation.model}
                          models={models}
                          defaultModelId={defaultModelId}
                          onModelChange={(model) =>
                            onUpdateConversation(conversation, {
                              key: 'model',
                              value: model,
                            })
                          }
                        />

                        {/* <SystemPrompt
                          conversation={conversation}
                          prompts={prompts}
                          onChangePrompt={(prompt) =>
                            onUpdateConversation(conversation, {
                              key: 'prompt',
                              value: prompt,
                            })
                          }
                        /> */}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Display model name and settings/clear buttons */}
                  <div className="flex justify-center border border-b-neutral-300 bg-neutral-100 py-2 text-sm text-neutral-500 dark:border-none dark:bg-[#444654] dark:text-neutral-200">
                    {t('Model')}: {conversation.model.name}
                    <button
                      className="ml-2 cursor-pointer hover:opacity-50"
                      onClick={handleSettings}
                    >
                      <IconSettings size={18} />
                    </button>
                    <button
                      className="ml-2 cursor-pointer hover:opacity-50"
                      onClick={onClearAll}
                    >
                      <IconClearAll size={18} />
                    </button>
                  </div>
                  {/* Show settings if enabled */}
                  {showSettings && (
                    <div className="flex flex-col space-y-10 md:mx-auto md:max-w-xl md:gap-6 md:py-3 md:pt-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
                      <div className="flex h-full flex-col space-y-4 border-b border-neutral-200 p-4 dark:border-neutral-600 md:rounded-lg md:border">
                        <ModelSelect
                          model={conversation.model}
                          models={models}
                          defaultModelId={defaultModelId}
                          onModelChange={(model) =>
                            onUpdateConversation(conversation, {
                              key: 'model',
                              value: model,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Render conversation messages */}
                  {conversation.messages.map((message, index) => (
                    <ChatMessage
                      key={index}
                      message={message}
                      messageIndex={index}
                      onEditMessage={onEditMessage}
                    />
                  ))}

                  {/* Display loader if conversation is loading */}
                  {loading && <ChatLoader />}

                  {/* Create empty space at the bottom of the chat */}
                  <div
                    className="h-[162px] bg-white dark:bg-[#343541]"
                    ref={messagesEndRef}
                  />
                </>
              )}
            </div>

            {/* Chat input and action buttons */}
            <ChatInput
              stopConversationRef={stopConversationRef}
              textareaRef={textareaRef}
              messageIsStreaming={messageIsStreaming}
              conversationIsEmpty={conversation.messages.length === 0}
              messages={conversation.messages}
              model={conversation.model}
              prompts={prompts}
              onSend={(message) => {
                setCurrentMessage(message);
                onSend(message);
              }}
              onRegenerate={() => {
                if (currentMessage) {
                  onSend(currentMessage, 2);
                }
              }}
            />
          </>
        )}
        {/* Scroll down button */}
        {showScrollDownButton && (
          <div className="absolute bottom-0 right-0 mb-4 mr-4 pb-20">
            <button
              className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-300 text-gray-800 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-neutral-200"
              onClick={handleScrollDown}
            >
              <IconArrowDown size={18} />
            </button>
          </div>
        )}
      </div>
    );
  },
);
Chat.displayName = 'Chat';
