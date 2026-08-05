import React, { useEffect, useState } from 'react';
import { Book, Chapter, Language } from '../types';
import { X, Sparkles, Send, Bot, RefreshCw, BookOpen, MessageSquare } from 'lucide-react';

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book | null;
  chapter?: Chapter | null;
  language: Language;
}

const createWelcomeMessage = (currentBook: Book | null, currentLanguage: Language) => {
  const title = currentBook?.titleSwahili || currentBook?.title || '';

  return {
    sender: 'assistant' as const,
    text:
      currentLanguage === 'sw'
        ? `Hujambo! Mimi ni Soma AI Assistant. Ungependa kuelewa nini kuhusu "${title}"? Unaweza kuniuliza kuhusu muhtasari, wahusika, au maana ya maneno ya Kiswahili.`
        : `Hello! I am your Soma AI Story Companion. How can I assist you with "${title}"? Feel free to ask for a chapter summary, character insights, or Kiswahili vocabulary explanations.`,
  };
};

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  onClose,
  book,
  chapter,
  language,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<
    { sender: 'user' | 'assistant'; text: string }[]
  >(() => [createWelcomeMessage(book, language)]);

  useEffect(() => {
    if (isOpen && book) {
      setMessages([createWelcomeMessage(book, language)]);
    }
  }, [isOpen, book, language]);

  if (!isOpen || !book) return null;

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || prompt;
    if (!textToSend.trim() || loading) return;

    const userMsg = textToSend;
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    if (!customPrompt) setPrompt('');
    setLoading(true);

    try {
      const response = await fetch('/api/gemini/story-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg,
          bookTitle: book.title,
          chapterTitle: chapter ? chapter.title : undefined,
          textContent: chapter ? chapter.content : book.description,
          language,
        }),
      });

      const data = await response.json();
      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: `Note: ${data.error}. (Please verify GEMINI_API_KEY in secrets).`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: 'assistant', text: data.result || 'No response generated.' },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'Unable to connect to Soma AI service. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts =
    language === 'sw'
      ? [
          'Nipe muhtasari wa sura hii',
          'Zola na Kaelen ni akina nani?',
          'Nifafanulie methali na maneno ya Kiswahili katika kitabu hiki',
        ]
      : [
          'Summarize this chapter for me',
          'Who are the main characters?',
          'Explain the East African cultural terms used here',
        ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Soma AI assistant"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-[#F8F7F2] h-full shadow-2xl flex flex-col border-l border-[#dec0b7]/40">
        {/* Header */}
        <div className="p-4 bg-[#a43d17] text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FFC837]" />
            <div>
              <h4 className="font-extrabold text-sm">Soma AI Companion</h4>
              <p className="text-[11px] text-white/80">
                {book.title} {chapter ? `• Ch ${chapter.number}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close AI assistant"
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message History */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${
                m.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {m.sender === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-[#ed7248] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-[#a43d17] text-white rounded-br-none shadow-sm'
                    : 'bg-white text-[#0a1f1d] border border-[#dec0b7]/30 rounded-bl-none shadow-xs'
                }`}
              >
                <p className="whitespace-pre-line">{m.text}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center text-xs text-[#6E7E7A]">
              <RefreshCw className="w-4 h-4 animate-spin text-[#a43d17]" />
              <span>Soma AI is analyzing...</span>
            </div>
          )}
        </div>

        {/* Quick Sample Prompts */}
        <div className="px-4 py-2 bg-[#e1f8f5]/60 border-t border-[#dec0b7]/20 flex gap-2 overflow-x-auto no-scrollbar">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              className="text-[11px] bg-white text-[#a43d17] border border-[#dec0b7]/40 px-3 py-1 rounded-full whitespace-nowrap hover:bg-[#a43d17] hover:text-white transition-all font-semibold"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input Footer */}
        <div className="p-3 bg-white border-t border-[#dec0b7]/30 flex items-center gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={
              language === 'sw' ? 'Uliza swali kuhusu kitabu hiki...' : 'Ask a question about this story...'
            }
            className="flex-1 bg-[#F8F7F2] py-2.5 px-4 text-xs sm:text-sm rounded-full border border-[#dec0b7]/30 focus:outline-none focus:ring-2 focus:ring-[#a43d17]"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !prompt.trim()}
            className="w-10 h-10 rounded-full bg-[#a43d17] text-white flex items-center justify-center hover:bg-[#ed7248] disabled:opacity-40 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
