import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ApiDocs from './ApiDocs.jsx'
import './styles.css'

// Static routing: /api-docs renders the API documentation page; everything else
// goes to the landing app. Uses a pathname check at the entry point (no router dep)
// so the dispatch happens before any hooks are called.
const path = window.location.pathname.replace(/\/$/, '')
const Page = path === '/api-docs' ? ApiDocs : App

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
)
