import React from 'react'
import ReactDOM from 'react-dom/client'
import BuyerIQ from './BuyerIQ.jsx'
import AuthGate from './components/AuthGate.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate>
      <BuyerIQ />
    </AuthGate>
  </React.StrictMode>,
)
