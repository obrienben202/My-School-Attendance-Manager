import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studentsRouter from "./students";
import coursesRouter from "./courses";
import attendanceRouter from "./attendance";
import targetsRouter from "./targets";
import ilpsRouter from "./ilps";
import scheduleRouter from "./schedule";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(studentsRouter);
router.use(coursesRouter);
router.use(attendanceRouter);
router.use(targetsRouter);
router.use(ilpsRouter);
router.use(scheduleRouter);

export default router;
