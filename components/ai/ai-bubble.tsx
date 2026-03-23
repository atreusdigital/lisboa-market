'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, X, Send, MessageCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const LISBOA_GREEN = '#1C2B23'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function AIBubble() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hola! Soy el asistente de Lisboa Market. ¿En qué te ayudo?' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    const res = await fetch('/api/ai/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, context: '' }),
    })
    const { reply } = await res.json()
    setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    setLoading(false)
  }

  return (
    <div className="fixed bottom-[72px] md:bottom-5 right-4 md:right-5 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {open && (
        <div className="w-[calc(100vw-2rem)] md:w-80 rounded-2xl shadow-2xl border border-border bg-white overflow-hidden flex flex-col" style={{ height: 400 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: LISBOA_GREEN }}>
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <span className="text-sm font-semibold">Asistente IA</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/10 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' && 'flex-row-reverse')}>
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                  msg.role === 'assistant' ? 'bg-neutral-900' : 'bg-neutral-200'
                )}>
                  <Bot className={cn('w-3 h-3', msg.role === 'assistant' ? 'text-white' : 'text-neutral-600')} />
                </div>
                <div
                  className={cn(
                    'max-w-[75%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                    msg.role === 'assistant' ? 'bg-neutral-50 border border-border text-neutral-900' : 'text-white'
                  )}
                  style={msg.role === 'user' ? { backgroundColor: LISBOA_GREEN } : {}}
                >
                  {msg.content.split('\n').map((line, j) => (
                    <p key={j} className={j > 0 ? 'mt-1' : ''}>{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-neutral-900 flex items-center justify-center shrink-0">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-neutral-50 border border-border rounded-xl px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-2 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Escribí tu pregunta..."
              className="h-8 text-xs flex-1"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="w-8 h-8 rounded-md flex items-center justify-center text-white disabled:opacity-40 shrink-0"
              style={{ backgroundColor: LISBOA_GREEN }}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bubble button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: LISBOA_GREEN }}
        title="Asistente IA"
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </button>
    </div>
  )
}
