import { useEffect, useState } from 'react'

/** Escucha una media query. Preguntamos por la capacidad, no por el dispositivo. */
export function useMedia(consulta: string): boolean {
  const [coincide, setCoincide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(consulta).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(consulta)
    const on = () => setCoincide(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [consulta])
  return coincide
}

/** Pantalla angosta: la ficha completa no entra de forma legible. */
export const useEsAngosta = () => useMedia('(max-width: 900px)')
