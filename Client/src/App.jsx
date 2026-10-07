
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import Login from './Components/Admin/Login'
import AdminDashboard from './Pages/Admin/AdminDashboard'
import AuthVerify from './Components/Admin/AuthVerify'

function App() {


  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Login />} />
          <Route element={<AuthVerify />}>

            <Route path='/admin-dashboard' element={<AdminDashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
