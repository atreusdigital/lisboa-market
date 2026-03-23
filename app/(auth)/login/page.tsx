'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WavyBackground } from '@/components/ui/wavy-background'
import { toast } from 'sonner'

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    // Acepta usuario (sin @) o email completo
    const email = login.includes('@')
      ? login.trim()
      : `${login.toLowerCase().trim()}@lisboa.internal`

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error('Usuario o contraseña incorrectos')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <WavyBackground
      colors={['#2d5a3d', '#1a7a4a', '#3d8b5e', '#0f4d2e', '#4a9e6b']}
      backgroundFill="#0f1a12"
      blur={8}
      speed="slow"
      waveOpacity={0.6}
      containerClassName="min-h-screen"
      className="w-full flex items-center justify-center px-4"
    >
      <div className="w-full max-w-sm">
        {/* Card glass */}
        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="inline-flex flex-col items-center gap-3 mb-2">
              <svg viewBox="0 0 120 120" className="w-20 h-20" xmlns="http://www.w3.org/2000/svg">
                <circle cx="60" cy="60" r="58" fill="#1C2B23" stroke="#1C2B23" strokeWidth="1.5"/>
                <circle cx="60" cy="60" r="50" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.4"/>
                <path id="loginTopArc" d="M 60,60 m -42,0 a 42,42 0 1,1 84,0" fill="none"/>
                <text fontSize="7.5" fill="white" fontFamily="Arial, sans-serif" fontWeight="600" letterSpacing="2.2">
                  <textPath href="#loginTopArc" startOffset="2%">MARKET 24/7 • BEBIDAS • KIOSCO •</textPath>
                </text>
                <path id="loginBottomArc" d="M 18,60 a 42,42 0 0,0 84,0" fill="none"/>
                <text fontSize="7.5" fill="white" fontFamily="Arial, sans-serif" fontWeight="600" letterSpacing="2.2">
                  <textPath href="#loginBottomArc" startOffset="2%">MARKET 24/7 • BEBIDAS • KIOSCO •</textPath>
                </text>
                <text x="60" y="67" textAnchor="middle" fontSize="26" fontWeight="700" fill="white" fontFamily="Arial, sans-serif" letterSpacing="-1">L24</text>
              </svg>
              <div>
                <span className="text-xl font-semibold tracking-tight">Lisboa Market</span>
                <p className="text-xs text-muted-foreground mt-0.5">Market 24/7</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">Ingresá a tu cuenta</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login" className="text-sm font-medium">Usuario o Email</Label>
              <Input
                id="login"
                type="text"
                placeholder="usuario o email"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                autoComplete="username"
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
            Sistema de gestión interno — Lisboa Market © 2026
          </p>
        </div>
      </div>
    </WavyBackground>
  )
}
