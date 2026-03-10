import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { EnvironmentProvider } from './context/EnvironmentContext'
import { DocsPage } from './components/DocsPage'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <EnvironmentProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </EnvironmentProvider>
    </BrowserRouter>
  </StrictMode>,
)
