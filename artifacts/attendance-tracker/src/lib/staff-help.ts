import type { Role } from "../hooks/use-role";

export type HelpTopic = {
  slug: string; title: string; summary: string; category: string;
  roles: Role[]; href: string; image: string;
  callouts: { number: number; title: string; description: string }[];
  steps: string[]; notes: string[];
};
const ALL: Role[] = ["admin", "hod", "staff", "office"];
const TEACHING: Role[] = ["admin", "hod", "staff"];
const MANAGEMENT: Role[] = ["admin", "hod"];
const SUPPORT: Role[] = ["admin", "hod", "office"];
const ADMIN: Role[] = ["admin"];

function topic(
  slug: string, title: string, summary: string, category: string, roles: Role[],
  href: string, labels: [string, string][], steps: string[], notes: string[] = [],
): HelpTopic {
  return {
    slug, title, summary, category, roles, href, image: `help-guide/${slug}.svg`,
    callouts: labels.map(([title, description], i) => ({ number: i + 1, title, description })),
    steps, notes,
  };
}

export const HELP_TOPICS: HelpTopic[] = [
  topic("getting-started", "Getting started", "Sign in, find your way around and get help.", "Getting started", ALL, "/", [
    ["Sidebar", "Choose a page from the school portal navigation; on a phone, open the menu first."],
    ["Help button", "The question-mark button opens the guide for the page you are using."],
    ["Account menu", "Open your account menu to view My details or Sign out."],
  ], [
    "Sign in with your individual school username and password. There is no public sign-up; ask the Admin Team about account or password problems.",
    "Use the sidebar to open your workspace. On a phone, use the menu at the top to reveal it.",
    "Select the question-mark Help button beside the notifications bell to open the Staff Help Guide in a new tab.",
    "Use the account menu to open My details. Sign out when finished, especially on a shared device.",
  ], ["Different roles see different navigation items. A guide is not permission to access a restricted screen.", "Illustrations use example information, never live learner records."]),
  topic("dashboard", "Dashboard", "Understand the overview and work that needs attention.", "Daily work", ALL, "/", [
    ["Overview", "Read the attendance and work summaries available to your role."],
    ["Navigation", "Open My Courses or eRegisters to work with the underlying records."],
    ["Attention bell", "Open the bell to review work that needs attention."],
  ], [
    "Open Dashboard in the sidebar to see your overview.",
    "Review the summaries, remembering that the information is limited to your role and assignments.",
    "Open the attention bell for outstanding work, then follow the relevant link.",
    "Use My Courses and eRegisters for the detailed records rather than treating a summary as an individual register.",
  ]),
  topic("my-details", "My details", "Find your staff profile and personal timetable.", "Getting started", ALL, "/my-details", [
    ["Account menu", "Choose My details from the top-right account menu."],
    ["Staff details", "Review your own directory-backed profile."],
    ["My Timetable", "Open your personal weekly timetable from your profile."],
  ], [
    "Open your account menu at the top right and choose My details.",
    "Check the staff details displayed. Report incorrect directory information to the Admin Team; do not create a replacement identity.",
    "Choose My Timetable to see your teaching sessions and personal activities.",
    "If a directory warning appears, read it before relying on optional staff information; a cached profile is not necessarily current.",
  ]),
  topic("timetable", "Personal timetable", "Read and print your weekly timetable without missing unusual session times.", "Daily work", ALL, "/my-details", [
    ["My Timetable", "Open the timetable from My details."],
    ["Weekly grid", "Read the full time range of each teaching session."],
    ["Additional sessions", "Check sessions outside the normal lesson grid as well as Print."],
  ], [
    "Open My details from the account menu and select My Timetable.",
    "Read each session's actual start and end time. A session crossing school periods may appear in more than one cell.",
    "Check the additional sessions section for activities overlapping registration, break or lunch.",
    "Use Print to open the browser print dialog. Check print preview before printing.",
  ], ["The grid does not change recorded lesson times.", "Week A/B labels are retained; they do not establish which calendar week is A or B."]),
  topic("courses", "My Courses", "Find a course, its learners, timetable and reports.", "Daily work", ALL, "/courses", [
    ["My Courses", "Choose a course from your course list."],
    ["Course links", "Use Enrolled Learners, Timetable Slots and Assessment Plan."],
    ["Course reports", "Use the report links or Print Curriculum for the selected course."],
  ], [
    "Choose My Courses in the sidebar and open the required course.",
    "Check the course code and year group before working with its records.",
    "Use Enrolled Learners for the course roster, Timetable Slots for sessions, and Assessment Plan for saved assessments.",
    "Open a course report from the right-hand panel, or use Print Curriculum. Use Export List for the enrolled-learner list.",
  ], ["The spreadsheet enrolment count and the actual linked learner roster are different values.", "For courses listed in the Sessions sheet, that sheet is authoritative. Older manual slots are retired during sync; maintain lasting session changes in the sheet. Courses absent from the sheet are not cleared.", "Only administrators and heads of department can edit timetable slots."]),
  topic("registers", "eRegisters", "Open the correct lesson, mark attendance and submit its register.", "Daily work", ALL, "/attendance", [
    ["eRegisters list", "Select the correct lesson and date before opening a register."],
    ["Attendance marks", "Choose each learner's attendance status; check the totals."],
    ["Save and submit", "Saving and submitting final are distinct actions."],
  ], [
    "Open eRegisters and find the lesson you need. Check its course, date and session time.",
    "Open the register and mark each learner using the available attendance statuses.",
    "Review the attendance totals and any absent learners. Do not assume a blank mark means present.",
    "Save your marks and wait for the success confirmation. If an error appears, the save is not confirmed.",
    "When the register is complete, submit it and confirm Submit Final. Read the final-submission dialog first.",
    "For an already submitted register, use its edit process only if you are authorised to correct it.",
  ], ["If no enrolled learners are available, ask an administrator to check the roster. Do not invent learners or marks.", "Staff access is limited to authorised registers. Submitted registers and corrections retain an audit history."]),
  topic("assessments", "My Assessments", "Find assessment definitions and open their marking screens.", "Daily work", TEACHING, "/assessments", [
    ["Assessment list", "Find the saved assessment by course and description."],
    ["Assessment Plan", "A course's Assessment Plan shows its saved assessment definitions."],
    ["Marking screen", "Open an assessment to work with the available learner results."],
  ], [
    "Open My Assessments, or open a course and select Assessment Plan.",
    "Check the course, assessment code, description and due date.",
    "Open the assessment or its Mark action to access the marking screen.",
    "Enter or amend only the results you are authorised to maintain, and wait for the save confirmation.",
    "Use My Unconfirmed Assessments to review results awaiting confirmation.",
  ], ["An empty Assessment Plan means no assessment definitions are saved for that course; it is not a set of zero marks.", "Do not describe grades as released unless the result's actual release status confirms it."]),
  topic("markbook", "Markbook and verification", "Locate learner results and review confirmation work.", "Daily work", TEACHING, "/markbook", [
    ["Markbook", "Open the current markbook from Workspace."],
    ["Result rows", "Check the assessment and learner before changing a result."],
    ["Verification", "Use Markbook Verification for the available confirmation workflow."],
  ], [
    "Open Markbook and locate the course or assessment you are working with.",
    "Check the learner and assessment identities before reading or changing results.",
    "Follow the available marking and save controls; an error is not a successful save.",
    "Open Markbook Verification to review items requiring confirmation.",
  ], ["Old Markbook is a separate licence-required screen, not the current markbook."]),
  topic("assignments", "Assignments and groups", "Find assignment groups and their result pages.", "Daily work", TEACHING, "/assignments-groups", [
    ["My Assignments / Groups", "Open the groups workspace from the sidebar."],
    ["Group or assignment", "Check the selected group and assessment before proceeding."],
    ["Assignment results", "Open the available results action for that assignment."],
  ], [
    "Open My Assignments / Groups in Workspace.",
    "Locate the assignment or group you need and check its course.",
    "Open its available results action and verify the learner and assignment before updating anything.",
    "Use the page's save controls and check the response rather than assuming a change has persisted.",
  ]),
  topic("learners", "Learner records", "Find learners and understand role-limited record access.", "Learner support", SUPPORT, "/students", [
    ["Learner list", "Use the learner list and its available filters."],
    ["Learner identity", "Check the person code as well as the learner's name."],
    ["Record detail", "Open the authorised learner record for further information."],
  ], [
    "Use At Risk Learners or the learner list to locate the required learner.",
    "Check the exact person code and year group; a matching name alone is not proof of identity.",
    "Open the learner record to view the information available to your role.",
    "Keep learner information private and use only approved school processes when sharing it.",
  ]),
  topic("targets", "Targets", "Find and review learner targets.", "Learner support", SUPPORT, "/targets", [
    ["Targets", "Open Targets under Learner tools."],
    ["Learner and target", "Check whom the target belongs to and what it asks."],
    ["Available actions", "Use only the target actions offered to your role."],
  ], [
    "Open Targets from Learner tools.",
    "Find the relevant learner or target using the page's available controls.",
    "Read its details before using any available update or review action.",
    "Wait for confirmation after saving, and keep notes appropriate for the learner record.",
  ]),
  topic("ilp-tutor", "ILPs and tutor reviews", "Review your assigned learners' termly submissions.", "Learner support", TEACHING, "/ilp-tutor/reviews", [
    ["Reviews", "Open ILP Tutor → Reviews."],
    ["Status filters", "Use statuses such as Submitted to find work awaiting review."],
    ["Teacher comment", "Add the review comment and date before completing the review."],
  ], [
    "Open ILP Tutor → Reviews and select a status such as Submitted.",
    "Open an assigned learner's review. Private answers remain restricted to the assigned RG teacher or explicitly authorised support access.",
    "Enter a Teacher comment and Review date, then select Save comment.",
    "Select Complete review when finished; both comment and date are required.",
    "If changes are needed, select Return to learner with a comment explaining what to change.",
  ], ["The legacy ILP workspace and termly learner reviews are separate workflows.", "Seeing shared staff comments does not grant access to a learner's private answers."]),
  topic("staff-ilp-comments", "Staff ILP comments", "Add shared staff comments without opening private learner answers.", "Learner support", ALL, "/termly-ilps/staff", [
    ["Staff ILP comments", "Open the shared comments area under ILP Tutor."],
    ["Review identity", "Check the learner, academic year and term."],
    ["Staff comment", "Add a separate staff comment using the page's available controls."],
  ], [
    "Open Staff ILP comments under ILP Tutor.",
    "Locate the appropriate learner and term, checking the learner's identity carefully.",
    "Read existing shared comments and add your own relevant staff observation.",
    "Save the comment and wait for confirmation before leaving.",
  ], ["Any signed-in school staff member, including office staff, can add a shared staff comment.", "This does not permit viewing private learner answers or completing the assigned RG teacher's review."]),
  topic("ilp-management", "ILP headers and groups", "Understand term forms, learner groups and management screens.", "Administration", MANAGEMENT, "/ilp-admin", [
    ["ILP Admin", "Open the management workspace."],
    ["Headers", "Review canonical form names and template versions."],
    ["Groups", "Inspect the term forms associated with each learner group."],
  ], [
    "Open ILP Admin and choose the management area you need.",
    "Use Headers to inspect actual form titles and template versions, rather than sample course headings.",
    "Open Groups and inspect Associated ILPs. These are the Term 1, Term 2 and Term 3 forms, not individual learner submissions.",
    "Follow a form link to the exact associated template and use the permitted save workflow for any change.",
  ], ["A published template is immutable; future changes require a new draft version.", "Only administrators run term publication and verified account linking in Termly ILPs."]),
  topic("termly-ilps", "Run termly ILPs", "Set up learner accounts, publish terms and preserve earlier reviews.", "Administration", ADMIN, "/ilp-admin/termly", [
    ["People tab", "Verify learner-account links and assign RG teachers."],
    ["Templates tab", "Prepare a draft version and publish it when ready."],
    ["Terms tab", "Preview a term's publication before confirming it."],
  ], [
    "Create individual school accounts through the school directory with learner or student roles. In User Management, use Sync from Google Sheet. There is no public sign-up and no shared learner account.",
    "Open Termly ILPs → People. Verify the account and exact Person code against the school roster, choose the Learner account and Save. Matching names or learner-supplied codes alone are not verification.",
    "Choose the RG teacher for each learner and Save. Use Only show missing account or RG teacher to find exceptions.",
    "In Templates, choose a form. For changes to a published version, use Clone as new draft version; edit the wording, sections and questions, Preview draft, Save template and Publish version.",
    "In Terms, enter Academic year, Term, published Template version, Start date, End date and Deadline.",
    "Choose Preview publication and review missing accounts, missing RG teachers and review counts. Select Publish term and confirm Publish for all learners.",
    "Use Create missing reviews for new learners on Overview when learners join later. Republishing does not duplicate or erase existing reviews.",
    "For the next academic year, publish the new year's Term 1, then Terms 2 and 3 as needed. Earlier learner reviews remain read-only history.",
  ], ["Learners can write from the start date; the end date is not a hard close. Late work is accepted and shown as overdue.", "Learners use My termly reviews, Save draft and Submit to Tutor. They can select Discuss with my RG teacher instead of typing a private answer.", "Existing reviews keep the template version they started with."]),
  topic("planned-absence", "Planned absence", "Find the planned-absence workspace and check learner/date details.", "Learner support", ALL, "/planned-absence", [
    ["Planned Absence", "Open the planned-absence workspace."],
    ["Learner and dates", "Check whom the absence concerns and its date range."],
    ["Available actions", "Use the actions shown for your role and record status."],
  ], [
    "Open Planned Absence from Learner tools.",
    "Check the learner, dates and details of the relevant planned absence.",
    "Use only the available actions for your role; wait for confirmation after saving.",
    "Check the actual register separately rather than assuming a planned absence has completed attendance marking.",
  ]),
  topic("reports", "Reports and printing", "Find reporting screens and print course information.", "Daily work", SUPPORT, "/reports", [
    ["Reports", "Open the reports workspace available to your role."],
    ["Report selection", "Choose the correct report and scope."],
    ["Course printing", "Course report links and Print Curriculum are on course detail pages."],
  ], [
    "Open Reports and choose the report you require using the available controls.",
    "Check the selected learners, courses and reporting scope before using the output.",
    "For a course-specific report, open My Courses, select the course and use the right-hand report links.",
    "Use the report's Print action or Print Curriculum and check your browser's print preview.",
  ], ["Some course reports use attendance bands as indicators; these are not verified assessment grades.", "Keep printed or exported learner information secure."]),
  topic("schedules", "Schedules and department timetable", "Find scheduling screens and recognise their scope.", "Administration", SUPPORT, "/schedules", [
    ["Schedules", "Open the scheduling workspace from Learner tools."],
    ["Department Timetable", "Administrators and heads of department can open the department view."],
    ["Recorded slots", "Check course identity, day, times, room and week pattern."],
  ], [
    "Open Schedules to view the scheduling workspace available to your role.",
    "Administrators and heads of department can also open Department Timetable under Administration.",
    "Check actual session times and week-pattern labels; the visual layout does not change the stored session.",
    "For a course represented in the Sessions sheet, make lasting changes in that source. Ask an administrator to refresh if necessary.",
  ], ["Office staff do not gain department timetable editing access from this guide.", "Unscheduled entries should be treated as unscheduled, not assumed to be Monday."]),
  topic("safeguarding", "Safeguarding", "Find the safeguarding area and handle information carefully.", "Learner support", TEACHING, "/safeguarding", [
    ["Safeguarding", "Open the safeguarding workspace from its sidebar section."],
    ["Learner record", "Check the exact learner identity before reading or adding information."],
    ["Restricted records", "Keep safeguarding information within authorised school processes."],
  ], [
    "Open Safeguarding and locate the relevant learner or record.",
    "Check the learner identity before recording information.",
    "Use the available notes and record actions only within your role and school policy.",
    "For an urgent concern, follow the school's safeguarding procedure immediately; do not rely on a portal note alone.",
  ], ["Safeguarding Admin is limited to administrators and heads of department.", "Never include real safeguarding records in screenshots, training material or shared examples."]),
  topic("progressions", "eProgressions", "Find learner progression information and enrolment progression screens.", "Learner support", SUPPORT, "/eprogressions", [
    ["eProgressions Hub", "Open the hub from the eProgressions sidebar section."],
    ["Learner progression", "Check the selected learner before opening their progression page."],
    ["Available actions", "Use the page's actual progression actions and confirmations."],
  ], [
    "Open eProgressions Hub.",
    "Locate the relevant learner or enrolment progression record.",
    "Check the learner identity before opening details or entering progression information.",
    "Use the page's available save or submission action and wait for confirmation.",
  ]),
  topic("concierge", "Concierge and enrolments", "Find applicants, applications, interviews and enrolment screens.", "Administration", SUPPORT, "/concierge", [
    ["Concierge", "Open the concierge workspace."],
    ["Applications", "Administrators and heads of department can open application management."],
    ["Enrolments", "Check applicant identity and record status before continuing."],
  ], [
    "Open Concierge and select Applicants, Interviews or Enrolments as appropriate.",
    "Check the applicant or learner identity and current record status.",
    "Use the available detail-page actions and wait for confirmation of any saved change.",
    "Administrators and heads of department can also use Applications; office access does not extend to all application-management screens.",
  ], ["Do not share applicant documents or personal information outside authorised school processes."]),
  topic("users", "User Management", "Understand directory roles and individually verified accounts.", "Administration", MANAGEMENT, "/admin/users", [
    ["User Management", "Open the user directory under Administration."],
    ["Directory roles", "School directory roles determine access."],
    ["Sync from Google Sheet", "Administrators can refresh users from the maintained directory."],
  ], [
    "Open User Management to inspect the accounts available to your role.",
    "Check the exact school username and directory role; names alone are not reliable identifiers.",
    "Administrators can use Sync from Google Sheet after the maintained directory is updated.",
    "For learners, use individual verified accounts and complete verified roster linking in Termly ILPs.",
  ], ["Heads of department have read-only user-management access.", "The external password-verification service checks passwords; it does not assign school roles.", "Do not publish passwords or credentials in guide images."]),
  topic("data-sync", "Data Sync", "Understand refresh results and authoritative course sessions.", "Administration", MANAGEMENT, "/admin/sync", [
    ["Data Sync", "Open the sync status page under Administration."],
    ["Refresh results", "Read counts and errors, not just the last-run time."],
    ["Manual refresh", "Only administrators can trigger a manual sheet refresh."],
  ], [
    "Open Data Sync to inspect the last refresh, counts and reported errors.",
    "The automatic refresh runs every 15 minutes. Ask an administrator to trigger a refresh if current changes are needed sooner.",
    "After a refresh, read the results for each source. A failed Sessions refresh keeps the existing schedules.",
    "For courses listed in a fully valid, non-empty Sessions sheet, the sheet replaces older manual or imported slots while retaining register history.",
    "Courses absent from the Sessions sheet and personal activities are not cleared. A blank or invalid sheet is not a deletion instruction.",
  ], ["Week A/B patterns are preserved without inventing a school-week calendar.", "Heads of department can inspect sync status but cannot run the administrator-only refresh."]),
];

export function getHelpTopics(role: Role): HelpTopic[] {
  return HELP_TOPICS.filter(t => t.roles.includes(role));
}

// Match detailed routes before their parent workspaces.
const HELP_ROUTES: [RegExp, string][] = [
  [/^\/help(?:\/|$)/, ""],
  [/^\/my-details(?:\/|$)/, "my-details"],
  [/^\/staff\/[^/]+\/timetable(?:\/|$)/, "timetable"],
  [/^\/staff\/[^/]+\/register-history(?:\/|$)/, "registers"],
  [/^\/staff(?:\/|$)/, "my-details"],
  [/^\/courses(?:\/|$)/, "courses"],
  [/^\/(?:attendance|registers)(?:\/|$)/, "registers"],
  [/^\/assessments(?:\/|$)/, "assessments"],
  [/^\/markbook(?:\/|$)/, "markbook"],
  [/^\/(?:assignments-groups|assignment-results)(?:\/|$)/, "assignments"],
  [/^\/(?:students|rooms|exams)(?:\/|$)/, "learners"],
  [/^\/termly-ilps\/staff(?:\/|$)/, "staff-ilp-comments"],
  [/^\/ilp-admin\/termly(?:\/|$)/, "termly-ilps"],
  [/^\/ilp-admin(?:\/|$)/, "ilp-management"],
  [/^\/(?:ilp-tutor|ilps)(?:\/|$)/, "ilp-tutor"],
  [/^\/planned-absence(?:\/|$)/, "planned-absence"],
  [/^\/targets(?:\/|$)/, "targets"],
  [/^\/reports(?:\/|$)/, "reports"],
  [/^\/(?:schedules|hod\/timetable)(?:\/|$)/, "schedules"],
  [/^\/safeguarding(?:\/|$)/, "safeguarding"],
  [/^\/eprogressions(?:\/|$)/, "progressions"],
  [/^\/concierge(?:\/|$)/, "concierge"],
  [/^\/admin\/users(?:\/|$)/, "users"],
  [/^\/admin\/sync(?:\/|$)/, "data-sync"],
  [/^\/$/, "dashboard"],
];

export function getHelpPath(path: string, role: Role): string {
  if (role === "learner") return "/learner-ilps";
  const pathname = path.split(/[?#]/, 1)[0];
  const slug = HELP_ROUTES.find(([pattern]) => pattern.test(pathname))?.[1];
  if (slug === "") return "/help";
  return getHelpTopics(role).some(t => t.slug === slug)
    ? `/help/${slug}` : "/help/getting-started";
}