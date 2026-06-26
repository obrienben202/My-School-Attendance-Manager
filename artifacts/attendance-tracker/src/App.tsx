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
import MyAssessments from "@/pages/my-assessments";
import AssessmentDetail from "@/pages/assessment-detail";
import AssignmentsGroups from "@/pages/assignments-groups";
import AssignmentResults from "@/pages/assignment-results";
import LicenceRequired from "@/pages/licence-required";
import EprogressionsHub from "@/pages/eprogressions/index";
import ProgressLearner from "@/pages/eprogressions/progress-learner";
import EnrolmentProgressions from "@/pages/eprogressions/enrolment-progressions";
import ConciergeIndex from "@/pages/concierge/index";
import ConciergeApplicants from "@/pages/concierge/applicants";
import ConciergeApplications from "@/pages/concierge/applications";
import ApplicationDetail from "@/pages/concierge/application-detail";
import ConciergeInterviews from "@/pages/concierge/interviews";
import EnrolmentsList from "@/pages/concierge/enrolments-list";
import EnrolmentsWizard from "@/pages/concierge/enrolments";
import EnrolmentOverview from "@/pages/concierge/enrolment-overview";

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
        <Route path="/assessments" component={MyAssessments} />
        <Route path="/assessments/:id" component={AssessmentDetail} />
        <Route path="/assignments-groups" component={AssignmentsGroups} />
        <Route path="/assignment-results/:id" component={AssignmentResults} />
        <Route path="/licence-required" component={LicenceRequired} />
        <Route path="/eprogressions" component={EprogressionsHub} />
        <Route path="/students/:id/progressions" component={ProgressLearner} />
        <Route path="/courses/:id/progressions" component={EnrolmentProgressions} />
        <Route path="/concierge" component={ConciergeIndex} />
        <Route path="/concierge/applicants" component={ConciergeApplicants} />
        <Route path="/concierge/applications" component={ConciergeApplications} />
        <Route path="/concierge/applications/:id" component={ApplicationDetail} />
        <Route path="/concierge/interviews" component={ConciergeInterviews} />
        <Route path="/concierge/enrolments" component={EnrolmentsList} />
        <Route path="/concierge/enrolments/new" component={EnrolmentsWizard} />
        <Route path="/concierge/enrolments/:id" component={EnrolmentOverview} />
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
