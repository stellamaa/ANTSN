import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

if (import.meta.env.DEV && window.location.hostname === 'localhost') {
  const port = window.location.port || '5173'
  window.location.replace(
    `http://127.0.0.1:${port}${window.location.pathname}${window.location.search}`,
  )
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
