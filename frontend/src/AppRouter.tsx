import { Link, BrowserRouter, Route,Routes } from "react-router-dom";
import LandingPage from "./features/landing/LandingPage";
import RegisterPage from "./features/auth/Register";
import LoginPage from "./features/auth/Login";
import Dashboard from "./features/auth/Dashboard";
import WorkSpacePage from "./features/workspace/pages/WorkSpacePage";
const AppRouter = () => {
  return (
      <BrowserRouter>
          <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/workspace" element={<WorkSpacePage/>} />
          </Routes>
      </BrowserRouter>
  )
}

export default AppRouter