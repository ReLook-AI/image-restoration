import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage    from './pages/HomePage'
import LoginPage   from './pages/LoginPage'
import PaymentPage from './pages/PaymentPage'
import UNetPage    from './pages/UNetPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<HomePage/>}/>
        <Route path="/login"   element={<LoginPage/>}/>
        <Route path="/payment" element={<PaymentPage/>}/>
        <Route path="/app"     element={<UNetPage/>}/>
      </Routes>
    </BrowserRouter>
  )
}
