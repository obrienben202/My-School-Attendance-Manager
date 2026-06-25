import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Students from "@/pages/students";
import StudentDetail from "@/pages/student-detail";
import Courses from "@/pages/courses";
import CourseDetail from "@/pages/course-detail";
import RegisterDetail from "@/pages/register-detail";
import ExamDetail from "@/pages/exam-detail";
import RoomDetail from "@/pages/room-detail";
import StaffDetail from "@/pages/staff-detail";
import Attendance from "@/pages/attendance";
import Targets from "@/pages/targets";
import Ilps from "@/pages/ilps";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/students" component={Students} />
        <Route path="/students/:id" component={StudentDetail} />
        <Route path="/courses" component={Courses} />
        <Route path="/courses/:id" component={CourseDetail} />
        <Route path="/registers/:id" component={RegisterDetail} />
        <Route path="/exams/:id" component={ExamDetail} />
        <Route path="/rooms/:id" component={RoomDetail} />
        <Route path="/staff/:id" component={StaffDetail} />
        <Route path="/attendance" component={Attendance} />
        <Route path="/targets" component={Targets} />
        <Route path="/ilps" component={Ilps} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
