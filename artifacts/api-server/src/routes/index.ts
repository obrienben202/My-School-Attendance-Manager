import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import studentsRouter from "./students";
import coursesRouter from "./courses";
import attendanceRouter from "./attendance";
import targetsRouter from "./targets";
import ilpsRouter from "./ilps";
import scheduleRouter from "./schedule";
import dashboardRouter from "./dashboard";
import assessmentsRouter from "./assessments";
import conciergeRouter from "./concierge";
import eprogressionsRouter from "./eprogressions";
import syncRouter from "./sync";
import hodRouter from "./hod";
import staffRouter from "./staff";
import plannedAbsencesRouter from "./planned-absences";
import safeguardingRouter from "./safeguarding";
import storageRouter from "./storage";
import reportsRouter from "./reports";
import termlyIlpsRouter from "./termly-ilps";
import ilpGroupsRouter from "./ilp-groups";

const router: IRouter = Router();
router.use(ilpGroupsRouter);

router.use(healthRouter);
router.use(authRouter);
router.use(termlyIlpsRouter);
// All old product APIs are staff-only, including new routers added below.
router.use((req, res, next) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });
  if (!["admin", "hod", "staff", "office"].includes(req.user.role)) {
    return res.status(403).json({ error: "This service is available to staff only" });
  }
  return next();
});
router.use(dashboardRouter);
router.use(studentsRouter);
router.use(coursesRouter);
router.use(attendanceRouter);
router.use(targetsRouter);
router.use(ilpsRouter);
router.use(scheduleRouter);
router.use(assessmentsRouter);
router.use(conciergeRouter);
router.use(eprogressionsRouter);
router.use(syncRouter);
router.use(hodRouter);
router.use(staffRouter);
router.use(plannedAbsencesRouter);
router.use(safeguardingRouter);
router.use(storageRouter);
router.use(reportsRouter);

export default router;
