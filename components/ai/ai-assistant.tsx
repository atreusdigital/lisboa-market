'use client'

import { useState, useRef, useEffect } from 'react'
import type { Profile } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Send, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const LISBOA_GREEN = '#1C2B23'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED = [
  '¿Qué productos estrella están en riesgo?',
  '¿Qué se vendió más hoy?',
  '¿Qué productos necesitan reposición urgente?',
  '¿Cuánto facturamos esta semana?',
]

interface Props {
  context: string
  profile: Profile
}

export function AIAssistant({ context, profile }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hola ${profile.full_name.split(' ')[0]} 👋 Soy el asistente de Lisboa Market. Tengo acceso al stock, ventas, alertas y pedidos en tiempo real. ¿En qué te ayudo?`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    const res = await fetch('/api/ai/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, context }),
    })
    const { reply } = await res.json()
    setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Asistente IA</h2>
        <p className="text-sm text-muted-foreground">Preguntá sobre ventas, stock, alertas o cualquier aspecto del negocio</p>
      </div>

      <Card className="border-border overflow-hidden">
        <div className="h-[420px] overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                msg.role === 'assistant' ? 'bg-neutral-900' : 'bg-neutral-200'
              )}>
                {msg.role === 'assistant'
                  ? <Bot className="w-3.5 h-3.5 text-white" />
                  : <User className="w-3.5 h-3.5 text-neutral-600" />
                }
              </div>
              <div className={cn(
                'max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'assistant' ? 'bg-neutral-50 border border-border' : 'text-white'
              )}
              style={msg.role === 'user' ? { backgroundColor: LISBOA_GREEN } : {}}
              >
                {msg.content.split('\n').map((line, j) => (
                  <p key={j} className={j > 0 ? 'mt-1' : ''}>
                    {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                  </p>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-neutral-50 border border-border rounded-xl px-4 py-3">
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

        <div className="border-t border-border p-3 space-y-2">
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-neutral-300 hover:bg-neutral-50 transition-colors text-muted-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Preguntá algo sobre el negocio..."
              className="flex-1 h-9 text-sm"
              disabled={loading}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="h-9 px-3 text-white"
              style={{ backgroundColor: LISBOA_GREEN }}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
