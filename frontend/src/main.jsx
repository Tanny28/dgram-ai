import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ApiDocs from './ApiDocs.jsx'
import Admin from './Admin.jsx'
import './styles.css'

// Static routing: pathname check at entry point (no router dep).
// /api-docs → API docs page
// /admin    → Admin dashboard (gated by ADMIN_EMAIL on the server)
// everything else → main landing app
const path = window.location.pathname.replace(/\/$/, '')
const Page = path === '/api-docs' ? ApiDocs
           : path === '/admin'    ? Admin
           : App

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
)
