'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm px-6">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="inline-flex flex-col items-center gap-3 mb-2">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#1C2B23' }}
          >
            <span className="text-white font-bold text-2xl tracking-tight">L24</span>
          </div>
          <div>
            <span className="text-xl font-semibold tracking-tight">Lisboa Market</span>
            <p className="text-xs text-muted-foreground mt-0.5">Market 24/7</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-4">Ingresá a tu cuenta</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="nombre@lisboamarket.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-10"
          />
        </div>

        <Button
          type="submit"
          className="w-full h-10 text-white"
          style={{ backgroundColor: '#1C2B23' }}
          disabled={loading}
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Sistema de gestión interno — Lisboa Market © 2025
      </p>
    </div>
  )
}
