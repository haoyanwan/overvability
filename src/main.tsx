import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { EnvironmentProvider } from './context/EnvironmentContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EnvironmentProvider>
      <App />
    </EnvironmentProvider>
  </StrictMode>,
)
