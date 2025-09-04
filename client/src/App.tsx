import { Route, Routes } from 'react-router-dom'
import './App.css'
import HomePage from './components/HomePage'
import GeneratePage from './components/GeneratePage'
import EnterPage from './components/EnterPage'
import SenderPage from './components/SenderPage'
import ReceiverPage from './components/ReceiverPage'
import { SocketProvider } from './hooks/SocketProvider';
import { store } from './store/store'
import { Provider } from 'react-redux'
import ToastUI from './hooks/ToastUI'
import PrivateRoute from './components/PrivateRoute'

function App() {
  return (
    <Provider store={store}>
      <SocketProvider>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/generate" element={<GeneratePage />} />
          <Route path="/enter" element={<EnterPage />} />
          <Route path="/sender-page" element={
              <PrivateRoute requiredAccess="sender">
                <SenderPage />
              </PrivateRoute>
            } />
            
            <Route path="/receiver-page" element={
              <PrivateRoute requiredAccess="receiver">
                <ReceiverPage />
              </PrivateRoute>
            } />
        </Routes>
      </div>
      </SocketProvider>
      <ToastUI />
    </Provider>
  )
}

export default App


// no error but theres a big problem, the req wont sent , the socket is possibly null