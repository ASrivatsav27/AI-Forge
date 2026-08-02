import { Link, BrowserRouter, Route,Routes,Outlet} from "react-router-dom";
import LandingPage from "./features/landing/LandingPage";
import RegisterPage from "./features/auth/Register";
import LoginPage from "./features/auth/Login";
import Dashboard from "./features/auth/Dashboard";
import WorkSpacePage from "./features/workspace/pages/WorkSpacePage";
import { ProjectProvider } from "./context/ProjectContext";
import ProtectedRoute from "./features/auth/ProtectedRoute";


function ProjectLayout() {
  return (
    <ProjectProvider>
      <Outlet />
    </ProjectProvider>
  );
}

const AppRouter = () => {
  return (
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
        
          {/* Project Routes */}
    <Route element={<ProtectedRoute />}>
     <Route element={<ProjectLayout />}>
     <Route path="/dashboard" element={<Dashboard />} />
     <Route path="/workspace/:projectId" element={<WorkSpacePage />} />
    </Route>
</Route>
        </Routes>
        </BrowserRouter>
  )
}

export default AppRouter