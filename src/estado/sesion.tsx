import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, mensajeError } from '@/lib/supabase'
import { aplicarBranding, BRANDING_POR_DEFECTO } from '@/lib/branding'
import type { Centro, Perfil } from '@/lib/tipos'

interface EstadoSesion {
  cargando: boolean
  session: Session | null
  perfil: Perfil | null
  centro: Centro | null
  entrar: (email: string, clave: string) => Promise<void>
  salir: () => Promise<void>
  recargarPerfil: () => Promise<void>
}

const Ctx = createContext<EstadoSesion | null>(null)

export function ProveedorSesion({ children }: { children: React.ReactNode }) {
  const [cargando, setCargando] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [centro, setCentro] = useState<Centro | null>(null)

  const cargarPerfil = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setPerfil(null); setCentro(null); aplicarBranding(BRANDING_POR_DEFECTO)
      return
    }
    const { data: p } = await supabase.from('perfiles').select('*').eq('id', uid).maybeSingle()
    setPerfil((p as Perfil) ?? null)

    if (p?.centro_id) {
      const { data: c } = await supabase.from('centros').select('*').eq('id', p.centro_id).maybeSingle()
      setCentro((c as Centro) ?? null)
      aplicarBranding((c as Centro)?.branding ?? BRANDING_POR_DEFECTO)
    } else {
      setCentro(null)
      aplicarBranding(BRANDING_POR_DEFECTO)
    }
  }, [])

  useEffect(() => {
    let vivo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return
      setSession(data.session)
      await cargarPerfil(data.session?.user.id)
      if (vivo) setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evento, s) => {
      if (!vivo) return
      setSession(s)
      await cargarPerfil(s?.user.id)
      setCargando(false)
    })
    return () => { vivo = false; sub.subscription.unsubscribe() }
  }, [cargarPerfil])

  const entrar = useCallback(async (email: string, clave: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave })
    if (error) throw new Error(mensajeError(error))
  }, [])

  const salir = useCallback(async () => {
    await supabase.auth.signOut()
    setPerfil(null); setCentro(null)
  }, [])

  const recargarPerfil = useCallback(async () => {
    await cargarPerfil(session?.user.id)
  }, [cargarPerfil, session])

  const valor = useMemo<EstadoSesion>(
    () => ({ cargando, session, perfil, centro, entrar, salir, recargarPerfil }),
    [cargando, session, perfil, centro, entrar, salir, recargarPerfil],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useSesion(): EstadoSesion {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>')
  return v
}
