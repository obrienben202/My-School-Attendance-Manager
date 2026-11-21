# Apps Script client contract

This is a standalone Apps Script package, not a React/Express extension. The UI files are `Index.html`, `Styles.html`, `Client.html`, and `Help.html` under `src/`. No CDN, external font, Replit server or public spreadsheet link may be required.

Call `google.script.run.withSuccessHandler(handler).withFailureHandler(handler).portalRpc(request)` with `{action, token, payload, requestId}`. Every response is `{ok:true,data}` or `{ok:false,error:{code,message,details}}`. Never render raw HTML returned in records. Use hash navigation. Store the bearer token only in sessionStorage, clear all records on sign-out or expired sessions, and do not cache passwords. Show a clear "Google connection unavailable" state outside Apps Script; never pretend demo records are live.

Actions:
- `login`: payload `{username,password,audience:"staff"|"learner"}` → `{token,expiresAt,user}`. Two sign-in audiences, no public signup or password-reset promise.
- `logout`: token → `{signedOut:true}`.
- `bootstrap`: token → `{user,modules,notices}`. User: `{id,username,displayName,role,studentId,department}`. Modules are server-filtered `{id,label,section,canCreate,canEdit,canDelete,fields}`.
- `dashboard`: token → `{counts:[{label,value}],notices:[string]}`. Display real counts, not charts or invented trends.
- `list`: payload `{entity,search,page,limit,filters?}` → `{rows,total,page,limit}`; limit ≤50. Each row contains `id`, `_revision`, and fields. Paging/search stays on server.
- `get`: payload `{entity,id}` → record.
- `save`: payload `{entity,record,expectedRevision}` → saved record. A new record omits id and expectedRevision. Supply a fresh requestId for each distinct save and reuse it when retrying the same failed submission. Do not make id/revision/identity fields editable.
- `remove`: payload `{entity,id,expectedRevision}` → `{removed:true}`. Confirmation required; this archives a record, not hard deletion.
- `submitRegister`: payload `{scheduleId,date,expectedRevision,marks:[{studentId,status,notes}]}` → `{register,marksSaved}`. Staff must open a register occurrence first via `register` payload `{scheduleId,date}`, returning `{register,students,marks}` with register `_revision` (0 if not yet created). Dates are YYYY-MM-DD. Statuses: Present, Absent, Late, Authorised, Not Marked. Include every enrolled learner once.
- `saveLearnerReview`: learner-only payload `{id,expectedRevision,work,submit:boolean}` → saved review; learner may change answers/summary/targets only, never teacher comments or assignments.
- `addStaffComment`: payload `{reviewId,comment}` → `{added:true}`. Separate shared comments, not authority to read private learner answers.
- `upload`: payload `{entity,id,name,mimeType,base64}` → `{id,name,mimeType,size}`. Max 2 MB; PDF/JPEG/PNG only. UI must remove base64 from form state after success.
- `download`: payload `{id}` → `{name,mimeType,base64}`. Build a temporary browser Blob for download; never share a Drive URL.
- `files`: payload `{entity,id}` → list of safe file metadata.
- `report`: payload `{kind:"attendance"|"assessment"|"enrolments"}` → `{columns,rows}`; authorised role only. Offer safe CSV export using string escaping and formula-injection protection.

Field metadata: `{key,label,type,required,readonly,options?}` where type is text, textarea, number, boolean, date, datetime, json, select. Render typed controls, nullable optional blanks, JSON validation with readable errors; never expose fields not in the metadata. Record keys use existing camelCase property names. JSON fields hold parsed JSON, not JSON-encoded strings.

Provide real navigation and read/create/edit/archive workflows for every module returned by bootstrap. Special pages: dashboard; attendance occurrence editor; reports; help; learner review editor. Module grouping, forms and presentation are the designer's decision. Generic table/forms are acceptable for specialist/admin configuration, but record relationship IDs must be labelled clearly. For uploads, expose record file controls wherever authorised (server rejects inappropriate entity access).

On CONFLICT preserve the draft and requestId, show the saved version in `error.details.current` for explicit reconciliation, and require a separate save after the user adopts the latest revision. Do not silently update expectedRevision. Other errors include AUTH, FORBIDDEN, VALIDATION, NOT_FOUND, CONFIG, BUSY, CAPACITY, INCOMPLETE_OPERATION.

Keep help in the top help action opening a new tab via Google's deployed service URL `?view=help`, not in the staff sidebar. Use only locally authored illustrative SVG diagrams or synthetic instructional pictures. Label illustrative data clearly. Include accessible labels, keyboard support, mobile navigation, loading/empty/error states, and no emojis.
