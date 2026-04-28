import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Workspace from './pages/Workspace'
import GeneratedApp from './pages/GeneratedApp'

function ProtectedRoute({ children, session }) {
  if (session === undefined) return null
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login session={session} />} />
        <Route
          path="/workspace"
          element={
            <ProtectedRoute session={session}>
              <Workspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/:convId"
          element={
            <ProtectedRoute session={session}>
              <Workspace />
            </ProtectedRoute>
          }
        />
        <Route path="/app/:slug" element={<GeneratedApp />} />
      </Routes>
    </BrowserRouter>
  )
}
