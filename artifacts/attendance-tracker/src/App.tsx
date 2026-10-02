import { useEffect, useRef } from "react";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useRole } from "@/hooks/use-role";
import LearnerIlps from "@/pages/learner-ilps";
import TermlyReviewPage from "@/pages/termly-review";
import IlpAdminTermly from "@/pages/ilp-admin/termly";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
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
import { StaffCorrespondence, StaffRegisterHistory, StaffRoomBookings, StaffTimetable } from "@/pages/staff-workflow";
import Attendance from "@/pages/attendance";
import Targets from "@/pages/targets";
import Ilps from "@/pages/ilps";
import MyAssessments from "@/pages/my-assessments";
import AssessmentDetail from "@/pages/assessment-detail";
import AssignmentsGroups from "@/pages/assignments-groups";
import AssignmentResults from "@/pages/assignment-results";
import LicenceRequired from "@/pages/licence-required";
import MarkbookMain from "@/pages/markbook/index";
import MarkbookVerification from "@/pages/markbook/verification";
import PlannedAbsence from "@/pages/planned-absence/index";
import ManageReports from "@/pages/reports/index";
import ManageSchedules from "@/pages/schedules/index";
import MyDetails from "@/pages/my-details";
import SafeguardingTutor from "@/pages/safeguarding/index";
import SafeguardingAdmin from "@/pages/safeguarding/admin";
import IlpTutorHub from "@/pages/ilp-tutor/index";
import IlpTutorReviews from "@/pages/ilp-tutor/reviews";
import IlpTutorLearners from "@/pages/ilp-tutor/learners";
import IlpTutorIlps from "@/pages/ilp-tutor/ilps";
import IlpTutorReviewDetail from "@/pages/ilp-tutor/review-detail";
import IlpAdminHub from "@/pages/ilp-admin/index";
import IlpAssigned from "@/pages/ilp-admin/assigned";
import IlpLearners from "@/pages/ilp-admin/learners";
import IlpHeaders from "@/pages/ilp-admin/headers";
import IlpGroups from "@/pages/ilp-admin/groups";
import TermlyStaffComments from "@/pages/termly-staff-comments";
import IlpReviews from "@/pages/ilp-admin/reviews";
import IlpSections from "@/pages/ilp-admin/sections";
import EprogressionsHub from "@/pages/eprogressions/index";
import ProgressLearner from "@/pages/eprogressions/progress-learner";
import EnrolmentProgressions from "@/pages/eprogressions/enrolment-progressions";
import ConciergeIndex from "@/pages/concierge/index";
import ConciergeApplicants from "@/pages/concierge/applicants";
import ConciergeApplications from "@/pages/concierge/applications";
import AdminUsers from "@/pages/admin-users";
import StaffHelp from "@/pages/staff-help";
import AdminSync from "@/pages/admin-sync";
import HodTimetable from "@/pages/hod-timetable";
import ApplicationDetail from "@/pages/concierge/application-detail";
import ConciergeInterviews from "@/pages/concierge/interviews";
import EnrolmentsList from "@/pages/concierge/enrolments-list";
import EnrolmentsWizard from "@/pages/concierge/enrolments";
import EnrolmentOverview from "@/pages/concierge/enrolment-overview";

const queryClient = new QueryClient();

function CacheGuard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const last = useRef<string | undefined>(undefined);
  const id = user ? String((user as { id?: string | number }).id ?? "") : "";
  useEffect(() => {
    if (last.current !== undefined && last.current !== id) qc.clear();
    last.current = id;
  }, [id, qc]);
  return null;
}

function Router() {
  const role = useRole();
  const { user } = useAuth();
  if (user && role === "learner") {
    return (
      <Layout>
        <Switch>
          <Route path="/learner-ilps" component={LearnerIlps} />
          <Route path="/termly-ilps/review/:id" component={TermlyReviewPage} />
          <Route><Redirect to="/learner-ilps" replace /></Route>
        </Switch>
      </Layout>
    );
  }
  return (
    <Layout>
      <Switch>
        <Route path="/learner-ilps"><Redirect to="/" replace /></Route>
        <Route path="/termly-ilps/staff" component={TermlyStaffComments} />
        <Route path="/termly-ilps/review/:id">{role === "office" ? <NotFound /> : <TermlyReviewPage />}</Route>
        <Route path="/ilp-admin/termly">{role === "admin" ? <IlpAdminTermly /> : <NotFound />}</Route>
        <Route path="/help" component={StaffHelp} />
        <Route path="/help/:topic" component={StaffHelp} />
        <Route path="/" component={Home} />
        <Route path="/students" component={Students} />
        <Route path="/students/:id" component={StudentDetail} />
        <Route path="/courses" component={Courses} />
        <Route path="/courses/:id" component={CourseDetail} />
        <Route path="/registers/:id" component={RegisterDetail} />
        <Route path="/exams/:id" component={ExamDetail} />
        <Route path="/rooms/:id" component={RoomDetail} />
        <Route path="/staff/:id/room-bookings" component={StaffRoomBookings} />
        <Route path="/staff/:id/timetable" component={StaffTimetable} />
        <Route path="/staff/:id/register-history" component={StaffRegisterHistory} />
        <Route path="/staff/:id/correspondence" component={StaffCorrespondence} />
        <Route path="/staff/:id" component={StaffDetail} />
        <Route path="/attendance" component={Attendance} />
        <Route path="/targets" component={Targets} />
        <Route path="/ilps" component={Ilps} />
        <Route path="/assessments" component={MyAssessments} />
        <Route path="/assessments/:id" component={AssessmentDetail} />
        <Route path="/assignments-groups" component={AssignmentsGroups} />
        <Route path="/assignment-results/:id" component={AssignmentResults} />
        <Route path="/licence-required" component={LicenceRequired} />
        <Route path="/markbook" component={MarkbookMain} />
        <Route path="/markbook/verification" component={MarkbookVerification} />
        <Route path="/planned-absence" component={PlannedAbsence} />
        <Route path="/reports" component={ManageReports} />
        <Route path="/schedules" component={ManageSchedules} />
        <Route path="/my-details" component={MyDetails} />
        <Route path="/safeguarding" component={SafeguardingTutor} />
        <Route path="/safeguarding/admin" component={SafeguardingAdmin} />
        <Route path="/ilp-tutor" component={IlpTutorHub} />
        <Route path="/ilp-tutor/reviews">{role === "office" ? <NotFound /> : <IlpTutorReviews />}</Route>
        <Route path="/ilp-tutor/learners" component={IlpTutorLearners} />
        <Route path="/ilp-tutor/ilps" component={IlpTutorIlps} />
        <Route path="/ilp-tutor/review/:id">{role === "office" ? <NotFound /> : <IlpTutorReviewDetail />}</Route>
        <Route path="/ilp-admin" component={IlpAdminHub} />
        <Route path="/ilp-admin/assigned" component={IlpAssigned} />
        <Route path="/ilp-admin/learners" component={IlpLearners} />
        <Route path="/ilp-admin/headers" component={IlpHeaders} />
        <Route path="/ilp-admin/groups" component={IlpGroups} />
        <Route path="/ilp-admin/reviews" component={IlpReviews} />
        <Route path="/ilp-admin/sections" component={IlpSections} />
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
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/sync" component={AdminSync} />
        <Route path="/hod/timetable" component={HodTimetable} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CacheGuard />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
