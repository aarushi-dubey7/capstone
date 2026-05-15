import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import StudentPortal from "./pages/StudentPortal";
import Onboarding from "./pages/Onboarding";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherSettings from "./pages/TeacherSettings";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/student" element={<StudentPortal />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/teacher" element={<TeacherDashboard />} />
      <Route path="/teacher/settings" element={<TeacherSettings />} />
      <Route path="/settings" element={<TeacherSettings />} />
    </Routes>
  );
}
