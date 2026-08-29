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

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
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

export default router;
