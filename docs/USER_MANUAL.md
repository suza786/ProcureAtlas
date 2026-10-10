# ProcureAtlas AI — Detailed User Manual

**Edition:** 10 October 2026  
**Audience:** Procurement researchers, bid teams, reviewers, tenant administrators and integration users  
**Scope:** The application currently implemented in this workspace

This manual explains how to find opportunities, maintain company evidence, manage a pursuit, prepare a proposal and record an approved submission. It also covers account security, intelligence modules, usage, integrations and troubleshooting.

Instructions use the English screen labels. You can switch the application to Bangla. Customer-entered text, source documents, some dynamic descriptions and API identifiers retain their original language.

## Contents

1. [Understand the workspace](#1-understand-the-workspace)
2. [Roles and permissions](#2-roles-and-permissions)
3. [First-time setup and quick start](#3-first-time-setup-and-quick-start)
4. [Sign in, recover access and enable MFA](#4-sign-in-recover-access-and-enable-mfa)
5. [Navigation, search, language and timezones](#5-navigation-search-language-and-timezones)
6. [Command Center](#6-command-center)
7. [Discover and Tender Digital Twin](#7-discover-and-tender-digital-twin)
8. [Company Brain and evidence](#8-company-brain-and-evidence)
9. [Evidence-backed capabilities](#9-evidence-backed-capabilities)
10. [LLM extraction and human review](#10-llm-extraction-and-human-review)
11. [Pursuits and Bid Room](#11-pursuits-and-bid-room)
12. [Compliance Matrix](#12-compliance-matrix)
13. [Proposal Studio](#13-proposal-studio)
14. [Approvals and submission](#14-approvals-and-submission)
15. [Financial Modeling](#15-financial-modeling)
16. [Buyer, award, competitor and partner intelligence](#16-buyer-award-competitor-and-partner-intelligence)
17. [Markets and connectors](#17-markets-and-connectors)
18. [Alerts and notifications](#18-alerts-and-notifications)
19. [Analytics](#19-analytics)
20. [Billing and usage](#20-billing-and-usage)
21. [API keys, Developer Portal and exports](#21-api-keys-developer-portal-and-exports)
22. [Webhooks and background jobs](#22-webhooks-and-background-jobs)
23. [Administration and audit](#23-administration-and-audit)
24. [Troubleshooting and operating checklists](#24-troubleshooting-and-operating-checklists)
25. [Advanced appendix: API-assisted workflow actions](#25-advanced-appendix-api-assisted-workflow-actions)
26. [Deployment appendix for operators](#26-deployment-appendix-for-operators)
27. [Glossary and reference files](#27-glossary-and-reference-files)

## 1. Understand the workspace

A **tenant** is your organization's workspace. Your users, company evidence, pursuits, proposals, compliance records, approvals, financial estimates and integration settings belong to that workspace. Signing in determines which tenant you can access. Changing a URL or copying another organization's record ID does not grant access to its private records.

Tender, buyer, supplier and award intelligence can come from a shared procurement catalog. A shared supplier profile does not make another organization's private supplier notes, competitor flags or partner preferences visible to you.

The main working sequence is:

**Discover a tender → review the source → create a pursuit → verify company evidence → resolve compliance → prepare and review proposal sections → complete assigned approvals → submit through the official channel → record submission → record the outcome.**

Use four working principles:

- **Evidence before AI:** substantiate claims with current, verified records.
- **Check the source:** confirm deadlines, amendments and requirements against the issuing authority's documents.
- **Treat AI output as a draft:** citations and confidence indicators help review; they do not prove a claim is true.
- **Separate approval from submission:** approving a proposal does not send it to the buyer.

### 1.1 Current interface boundaries

The application includes working read and workflow APIs, but several operations do not yet have full screen editors. This manual identifies these as **API-assisted** and supplies procedures in Section 25.

| Operation | Current way to perform it |
| --- | --- |
| Upload evidence and monitor file processing | Company Brain → Add Evidence |
| Verify evidence and record structured financial/eligibility facts | Manager-level API-assisted action |
| Add supported company capability facts | Company Brain → Evidence-backed capabilities |
| Read compliance statuses and evidence links | Compliance Matrix |
| Change compliance status or attach evidence | Contributor-level API-assisted action |
| Inspect approval-chain configuration | Approvals → chain configuration dialog |
| Create or update approval chains | Admin-level API-assisted action |
| Edit proposal text, generate drafts, approve sections and save versions | Proposal Studio |
| Attach evidence IDs to a manually authored section | API-assisted action; AI drafting can populate references automatically |
| View exchange rates | Financial Modeling → Currency Rates |
| Add or update dated exchange rates | Manager-level API-assisted action |
| Download exported data | Versioned export API; Explorer or an integration client |

Do not interpret an inactive or unfinished button as a completed operation. In particular, the empty Bid Room **Request Approval** placeholder is not the supported way to create submission approvals. Create the proposal instead; its creation establishes the submission approval records.

## 2. Roles and permissions

Roles form a hierarchy: **owner → admin → manager → contributor → viewer**. Higher roles generally include the permissions of the lower roles, with additional account and assignment safeguards.

| Role | Typical responsibility | Examples |
| --- | --- | --- |
| Viewer | Research and read permitted workspace records | Discover, intelligence, pursuits, proposals and compliance views |
| Contributor | Prepare bid material | Create pursuits/proposals, upload evidence, edit sections, complete tasks, update compliance and create cost estimates |
| Manager | Validate readiness and review work | Verify evidence, review extractions, approve sections, advance pursuit stages, decide eligible approval steps and record submission |
| Admin | Maintain the tenant and its integrations | Invite/deactivate users, manage ordinary roles, create approval chains, manage API keys/webhooks, inspect audit and system information, run permitted connectors |
| Owner | Protect organizational control | Owner-sensitive account changes and billing administration, in addition to the other roles |

Important permission rules:

1. A higher role cannot bypass an approval assigned to a different person.
2. An approver must belong to the tenant and meet the required role.
3. Earlier steps in a chain must be approved before later steps.
4. Owner-account changes have extra safeguards. The organization must retain at least one owner.
5. User administration and system information have different access levels: managers may read the user list; user mutations, invitations, system information, API-key administration, connectors and audit access require admin or owner permissions.
6. Production paid entitlements require verified billing events. Owner access alone does not enable an unverified upgrade.

Some modules remain visible in navigation even when your role cannot use every action. If an action returns a permission error, request the appropriate access from your tenant administrator rather than repeatedly retrying it.

## 3. First-time setup and quick start

### 3.1 What the administrator must prepare

Before the team starts a real bid, the tenant administrator/operator should confirm:

- The tenant, initial owner and company record exist. There is no complete self-service company/tenant onboarding wizard in the current interface.
- Team members have the appropriate roles and sufficient subscription seats.
- Invitation/recovery email delivery and the background worker are configured.
- File scanning is available, with private upload storage.
- The company has usable evidence and reviewers who can verify it.
- Required approval chains are configured before proposals are created.
- AI provider access is configured if the team intends to use extraction or drafting.
- Production uses real authentication; demo settings are disabled.

### 3.2 First session for a new team member

1. Open your invitation link, choose a password and sign in.
2. Open **Settings** and confirm your email, role and tenant.
3. Set the display timezone in the top bar. Use the timezone your team will use when coordinating deadlines.
4. Enable an authenticator if your organization requires MFA.
5. Open **Company Brain** and inspect the evidence library. Report missing or expired records.
6. Open **Discover**, choose a market and sector, and search for a relevant opportunity.
7. Open its **Tender Digital Twin** and check the original source and deadline.
8. If you have contributor access, choose **Create Pursuit**.
9. Ask a manager to progress the pursuit and review its mandatory requirements.
10. Follow Sections 11–14 to prepare, approve and record the submission.

### 3.3 Demonstration use

Demo credentials and a skip/explore control may appear only when demo functionality is explicitly enabled. Use demonstration environments for training, not real procurement submissions. Do not assume the skip control is a production guest-access feature or a security boundary. In a demo-enabled deployment, server-side fallback access can have broad permissions even when the screen appears to be in exploration mode.

## 4. Sign in, recover access and enable MFA

### 4.1 Sign in

1. Open **Sign in**.
2. Enter the email address registered for your account.
3. Enter your password and choose **Sign in**.
4. If an authenticator challenge appears, enter the current six-digit code and submit again.
5. Confirm that you arrive in the correct workspace.

New invitation/recovery passwords require at least 12 characters and at most 72 UTF-8 bytes. Non-English characters can occupy more than one byte, so 72 characters is not always a valid 72-byte password.

Five failed password attempts can lock the account for 15 minutes. Account/IP throttling can also slow repeated attempts. Wait for the stated period or contact an administrator who can unlock an ordinary account. Do not keep submitting the same incorrect credentials.

Sessions have a seven-day absolute lifetime and a 12-hour idle timeout. Password changes, account deactivation and authenticator changes can invalidate access before those limits.

### 4.2 Accept an invitation or reset a password

1. For recovery, select **Forgot your password?** and enter your account email.
2. Check your inbox and spam folder for the account link.
3. Open the latest valid link.
4. Enter and confirm the new password.
5. Choose **Set password** and return to sign in.

Account links expire and can be used once. The recovery confirmation deliberately does not disclose whether an email address has an active account. If no email arrives, an administrator should check the configured mail service and background jobs. A successful request does not guarantee that email has already been delivered.

Changing a password revokes existing credentials. Integrations using revoked API keys will require replacement keys. Recovery does not remove an enabled authenticator challenge.

### 4.3 Enable an authenticator

1. Open **Settings → Authenticator verification**.
2. Enter your current password and select **Set up authenticator**.
3. In your authenticator application, add the account using the displayed setup key or **Open authenticator app** link.
4. Finish within the displayed setup period, currently 10 minutes.
5. Enter the current six-digit code and choose **Enable authenticator**.
6. Sign in again with your password and code.

Enabling or disabling the authenticator signs you out and revokes API keys. Plan an integration key rotation before changing this setting. Keep the setup key private. The current interface does not provide a complete backup-code or self-service lost-authenticator recovery flow; contact your organization's authorized administrator if access is lost.

To sign out normally, open **Settings → Sign out**. Close shared-device sessions when you finish.

## 5. Navigation, search, language and timezones

### 5.1 Desktop and mobile navigation

- On desktop, use the left module menu.
- On mobile, open the top-bar **module menu** button and choose a module.
- Use the breadcrumb or the view's back button to return to a parent view.
- Browser **Back**, **Forward** and **Refresh** preserve supported module/detail navigation.
- Copy the address bar to share a tender, pursuit, buyer, supplier or proposal detail link. The recipient still needs access to the tenant/record.

Examples of supported detail links:

```text
/?view=tender&tenderId=RECORD_ID
/?view=bid-room&pursuitId=RECORD_ID
/?view=compliance&pursuitId=RECORD_ID
/?view=proposal-editor&proposalId=RECORD_ID
```

Discover filters are reflected in the URL. Do not assume every temporary dialog, tab selection or operational-list page position is restored on refresh.

### 5.2 Global search

1. Focus the top-bar search field, or press **Ctrl+K** / **Command+K**.
2. Enter at least two characters.
3. Wait for the results. The application debounces input and cancels superseded searches.
4. Click a result, or use **Arrow Up/Down** followed by **Enter**.
5. Press **Escape** to close the results.

Search covers tenders, buyers, suppliers, awards, and your tenant's companies and pursuits. Award results open their related tender. Company results open Company Brain. Results are bounded samples; a short list is not a count of the entire matching catalog. Use a more specific phrase or the relevant module's filters when needed.

### 5.3 Language and timezone

Use the top-bar language button to switch between **EN** and **Bangla**. The choice is saved for that browser. Use the timezone selector for UTC, Asia/Dhaka, Asia/Singapore, Europe/Brussels or America/New_York. Deadline date/time displays include the selected timezone.

For team coordination, share the full date, time and timezone, not only a “days remaining” indicator. Analytics observation days use UTC regardless of the personal display timezone.

### 5.4 Keyboard use and loading states

Use **Tab/Shift+Tab** to move between controls, **Enter/Space** to activate buttons and **Escape** to dismiss supported dialogs. Evidence/proposal/approval dialogs keep focus inside the dialog and return it to the launching control when closed. Busy operations can temporarily prevent dismissal.

Views and charts load on demand. A loading placeholder is normal during module changes. Filtered catalog responses may be reused briefly; successful mutations and authentication changes invalidate cached results. For an urgent source update, use **Retry**, reload, or confirm against the original procurement portal.

## 6. Command Center

Use **Command Center** as a daily overview of active opportunities, pipeline value, pursuit activity and alerts.

1. Review the headline totals and active pipeline indicators.
2. Inspect high-severity or time-sensitive alerts.
3. Open the relevant tender or pursuit for detailed action.
4. Check the daily briefing against current source documents before deciding to bid.

Totals and preview lists serve different purposes. A limited list of recent records does not imply that the headline total is capped to that list. Pipeline values are estimates derived from recorded data, not recognized revenue. Empty or unknown values can mean that data is missing; do not substitute guessed amounts.

## 7. Discover and Tender Digital Twin

### 7.1 Find a tender

1. Open **Discover**; the page heading is **Tender Radar**.
2. Select a market, sector and status.
3. Enter a title or keyword in the search field.
4. Use **Previous/Next** where available to browse more results.
5. Open the tender row or its detail control.

Choose **All** status when you need records outside the default active listing. An opportunity's presence in the catalog does not guarantee that its deadline has not changed.

### 7.2 Review the Tender Digital Twin

Use the detail tabs:

| Tab | What to inspect |
| --- | --- |
| Overview | Buyer, procurement method, value, important dates, lots and source information |
| Requirements | Mandatory/optional criteria and available source references |
| LLM Extraction | Extraction result and review-queue navigation |
| Amendments | Changes, revised deadlines and amendment details |
| Awards | Recorded winners, original values and award information |
| Scoring Detail | Eligibility, opportunity-fit components and available readiness scoring |

Check the issuing portal's original notice and documents. Confidence measures and extracted text are aids, not a replacement for those documents. An absent monetary threshold, currency or source clause should be clarified rather than inferred from a score.

### 7.3 Create a pursuit

1. Sign in with contributor or higher access.
2. Choose **Create Pursuit** on the tender.
3. The application opens the pursuit's Bid Room.
4. Check that the tender and company are correct.

Creation initializes a draft bid and gap compliance records for the tender's recorded requirements. Repeating creation for the same tenant/company/tender reuses the existing pursuit rather than creating an unintended duplicate.

If your tenant has multiple companies, the current tender button does not present a complete company-selection dialog. Use the company-specific API-assisted procedure in Section 25 or ask your administrator to perform it. A “Select a company” message must not be bypassed by choosing an unrelated company ID.

## 8. Company Brain and evidence

Company Brain displays the company profile, evidence library, certifications, project references, personnel information, expiry indicators and supported capability facts. Not every displayed profile field has an editor in the current interface; request authorized updates through your administrator/integration process.

### 8.1 Upload evidence

1. Open **Company Brain → Add Evidence**.
2. Enter a clear title, for example “Audited financial statement — FY2025”.
3. Select the category that describes the document.
4. Enter the issuer and expiry date when applicable.
5. Select a supported file and submit the upload.
6. Watch the processing status before closing the dialog.

Supported upload formats include PDF, PNG, JPG/JPEG, TXT, DOCX and XLSX. The current file limit is **25 MiB**, including additional archive-expansion checks for Office documents. Renaming an executable or unrelated file to `.pdf` does not make it acceptable.

Choose categories consistently: registration for legal registrations, financial for reviewed financial evidence, certification for certificates, project/reference for supported past performance, and partnership for relevant partner/JV evidence.

### 8.2 Understand processing and verification

File processing and evidence verification are separate:

| Condition | Meaning | Next action |
| --- | --- | --- |
| Pending/quarantined | A scan has not completed successfully | Wait or check processing status |
| Scan error/unavailable | The configured scanner could not complete | Ask the operator to inspect the worker/scanner |
| Infected | The scanner detected a threat | Do not distribute the file; follow the organization's response process |
| Clean with recorded scan provenance | The file passed its scan | Download is permitted to an authorized user |
| Evidence unverified | Nobody has approved its factual use yet | Manager reviews the actual document |
| Verified/current | A reviewer approved the record and its dates permit use | Use it for matching and claim support where appropriate |
| Expired/future-dated | The evidence is not current | Renew or correct it before relying on it |

A clean malware scan does not verify turnover, experience or certification. Newly uploaded evidence starts unverified. A manager records verification and any structured facts using the API-assisted action in Section 25.

If automatic status checks pause, choose **Check processing status again**. Download remains unavailable until a genuine successful scan is recorded. Actual PDF, DOCX and plain-text extraction is supported; images and spreadsheets are not a complete OCR/spreadsheet analysis workflow.

### 8.3 Maintain useful evidence

Keep titles, dates, categories and issuer names consistent. Renew expiring certificates before the bid deadline. Use separate evidence for unrelated claims. Do not treat a personnel row alone as verified proof of a qualification.

Reviewing, changing or withdrawing evidence can invalidate approvals for editable work that relied on it. Recheck affected pursuits instead of assuming an earlier approval remains sufficient.

## 9. Evidence-backed capabilities

Open the **Evidence-backed capabilities** section in Company Brain.

1. Choose the fact type: sector, certification, annual turnover, prior JV partner ID or project sector.
2. Enter the fact value using your team's consistent vocabulary.
3. For turnover, provide the amount and currency and ensure they match the reviewed financial record.
4. Select a current, verified supporting evidence record of an appropriate category.
5. If recording a supplier/partner fact, enter the actual supplier organization ID in the optional supplier field.
6. Choose **Add fact**, or edit/delete an existing fact where permitted.

Missing support produces **unknown**, not a positive match. Sector evidence, certification evidence and financial evidence are not interchangeable. A JV fact should use the actual partner ID, not only a display name. Supplier capacity comparisons currently rely on recorded USD turnover; do not assume automatic currency conversion or a proven relationship from a suggested match.

Use the section's pagination to inspect additional saved facts. If no evidence appears in its selector, check verification, category, expiry and issue date before concluding that the selector is broken.

## 10. LLM extraction and human review

### 10.1 Request extraction

1. Open the tender's detail view.
2. Choose **Extract Requirements (LLM)**.
3. Wait for a result or explicit error.
4. Open **LLM Review Queue** to inspect the extraction.

Extraction is provider-dependent and consumes quota. Do not assume the action automatically reads every linked PDF. The tender action works from its configured tender text/input; separately uploaded file text is not a promise of automatic ingestion into all extraction flows.

### 10.2 Review extracted requirements

Managers, admins and owners can review eligible pending extractions.

1. Filter the queue to **Pending** and select the extraction.
2. Compare every criterion with the original procurement clause.
3. Verify mandatory flags and source snippets.
4. Choose **Edit before approve** when a correction is needed.
5. For numeric checks, supply the structured metric, comparison, amount, currency and unit.
6. Add review notes explaining material corrections.
7. Approve the reviewed result, approve edits, or reject unsupported output using the available action.

Example of a reviewed turnover requirement:

```text
Metric: annual_turnover
Comparison: >=
Amount: 100000
Currency: USD
Unit: money
Mandatory: yes
```

The supporting evidence must use the same metric and compatible unit/currency. Enter amounts as digits and an optional decimal point; do not enter “1 lakh”, “100K”, a currency symbol, or a comma-separated formatted amount in the structured amount field. Leave uncertain values unresolved instead of guessing.

Reviewed extraction annotations are private to the tenant. Approval does not authorize rewriting shared catalog requirements or removing an existing mandatory gate. Final review decisions are conditionally claimed so replay does not insert duplicate reviewed requirements.

After approving a review, refresh the affected pursuit/scoring and inspect requirement coverage. If a reviewed condition is not represented by an editable compliance row, ask the administrator to inspect the evaluation records rather than manufacture a new requirement ID.

## 11. Pursuits and Bid Room

### 11.1 Use the pipeline

Open **Pursuits** to see cards and the table of recorded pursuits. **New Pursuit** takes you to tender discovery; it is not a separate free-form tender creation wizard. Open a pursuit to enter its Bid Room.

| Stage | Meaning | Normal next action |
| --- | --- | --- |
| discovering | An opportunity has been recorded | Review source and initial fit |
| qualifying | The team is checking eligibility and commercial fit | Resolve mandatory requirements and decide whether to bid |
| bidding | The team is preparing the submission | Complete tasks, compliance, sections and approvals |
| submitted | Submission has been recorded through the approved proposal workflow | Track the official result |
| won | The submitted bid was recorded as successful | Follow the organization's handover process |
| lost | The submitted bid was recorded as unsuccessful | Record lessons through the organization's process |
| no_bid | The team chose not to continue | Requalify if an authorized decision changes |

Managers use **Move to qualifying**, **Move to bidding**, **Record no bid**, or the relevant outcome action. The supported path does not include a direct “move to submitted” stage shortcut. A no-bid pursuit can return to qualifying. Won/lost pursuits are terminal in the stage model.

### 11.2 Use Bid Room

1. Check the tender, company context, deadline, estimated value and scores.
2. Review the actual bid tasks and their current status.
3. Contributors can choose **Mark done** or **Reopen** on permitted, unlocked tasks.
4. Open **Compliance Matrix** to review requirements and linked evidence.
5. Inspect the recorded approval statuses.
6. Use **View Tender Digital Twin** when you need source context.

The current UI does not include a complete task creation/assignment planner. Existing tasks can be completed/reopened; task provisioning follows your administrator/integration process. A missing task list does not demonstrate that real-world submission preparation is complete.

Compliance and task changes reset relevant approvals and readiness for editable work. Submitted, won and lost pursuits lock their task/compliance changes. Proposal creation and section work occur in Proposal Studio, not through the empty Bid Room approval placeholder.

## 12. Compliance Matrix

Open the matrix from the pursuit's Bid Room. The navigation module may first route you through Pursuits because compliance is attached to a specific pursuit.

The matrix shows saved criteria, mandatory flags, threshold/source information, linked evidence and status. Use **All**, **Compliant**, **Partial**, **Gap** or **N/A** filters to focus the review.

| Status | How to use it |
| --- | --- |
| compliant | The criterion is recorded as met with current, verified company evidence |
| partial | Some support exists, but the criterion is not fully met |
| gap | Required support is missing or unresolved |
| not_applicable | The criterion was recorded as inapplicable after a justified review |

Coverage counts compliant rows fully, partial rows at half weight, and excludes recorded N/A rows from its denominator. It is a progress indicator, not the final submission gate.

The current matrix is a read view. To attach evidence or change a saved status, use the contributor-level API-assisted procedure in Section 25. Refresh the matrix afterward.

Submission still requires every mandatory eligibility check to pass. Marking a mandatory row N/A or writing “compliant” in proposal text cannot bypass that check. A previously compliant row whose evidence expires or loses verification needs renewed review even if the saved status has not changed.

When a check is unknown, inspect its reviewed metric, amount, unit, currency, operator, evidence validity and any dated exchange rate. Ask the manager to resolve the underlying data before final approval.

## 13. Proposal Studio

### 13.1 Create a proposal

1. Ensure the pursuit is in **bidding**.
2. Open **Proposal Studio → New Proposal**.
3. Select the pursuit and enter a meaningful title.
4. Choose **Create with 9 default sections**.

Default sections are Executive Summary, Technical Approach, Methodology, Team & Key Personnel, Past Performance, Pricing, Compliance Matrix, Risk Management, and Timeline & Milestones. Creating the proposal creates its submission approvals from the active configuration, or a default manager submission approval when no submission chain exists.

### 13.2 Write and save a section

1. Open the proposal and choose a section from the section list.
2. Enter or revise its content.
3. Leave the text field to trigger auto-save.
4. Wait for **Changes saved** before navigating away.
5. Use **Save Version** at meaningful milestones and provide a change summary.

Auto-save on blur is different from a version snapshot. A version captures section content and evidence references at that point. The current interface does not provide a complete restore/diff workflow for historical versions.

If **Unsaved changes**, **Saving changes…**, or a save error is visible, do not assume the server has your text. Use **Retry save** for a recoverable failure. **Reload latest (keeps local edits)** preserves local text for deliberate reconciliation; compare it with the latest saved record before retrying a conflicting write. Copy critical unsaved text to an approved temporary location before closing or refreshing the browser.

### 13.3 Use AI Draft

1. Ensure suitable current, verified company evidence exists.
2. Select the section and choose **AI Draft**.
3. Wait for pending saves and the draft request to finish.
4. Review the generated prose, citations, evidence count and gap messages.
5. Correct unsupported claims and resolve `[gap: ...]` markers.
6. Save the corrected text and have a manager review it.

AI Draft uses approved evidence IDs and validates returned references. It can still misinterpret valid evidence. Verify every factual claim against the cited record. No evidence or an unresolved mandatory criterion can cause gaps or a rejected draft; repeatedly generating text is not a substitute for resolving those records.

### 13.4 Attach evidence to manual content

The text editor does not currently provide a full citation-picker interface. Typing `[evidence:ID]` in text alone does not populate the section's stored evidence list. Use Section 25 to attach current, verified evidence IDs to a manually written section, then reload the editor.

### 13.5 Human section review

Managers and higher roles can choose **Approve reviewed section** after reviewing the content. Each section needs nonempty content, current evidence references and resolved gaps. Generated text remains subject to this review.

Editing approved content can return the proposal to draft and reset consequential approvals. Finish content and evidence corrections before asking approvers to make final decisions. Pending saves are awaited before drafting, section review, versioning or status changes. Concurrent edits are rejected rather than silently overwriting another user's work.

## 14. Approvals and submission

### 14.1 Configure the review process

Before creating proposals, an admin/owner should configure the intended submission, pricing or legal chains using Section 25. The **Approvals** chain dialog displays configuration; it is not a full chain editor.

Each chain specifies a trigger, ordered steps, required roles and optional named approvers. Named approvers must be valid tenant users with the required role. Step orders are consecutive, starting at 1. Plan chain changes before active reviews; changing configuration mid-review can require administrative reconciliation.

### 14.2 Send and review

1. The author completes the proposal and waits for saved changes.
2. A manager reviews and approves every section.
3. Choose **Send for review** from the proposal's draft state.
4. Assigned approvers open **Approvals → Pending**.
5. Inspect the related proposal, evidence, compliance and commercial decision.
6. Approve, reject or request changes using the appropriate action and reason.
7. Complete the earlier chain steps before later ones.

Approval records can already appear because they were created with the proposal. **Send for review** changes the proposal's review state; do not interpret it as a guarantee of an external email notification.

The final approval checks readiness. If it fails, resolve the stated condition and retry the eligible pending step. Final approval requires the proposal's sections, evidence, mandatory eligibility, compliance, task completion and approval configuration to be consistent. An owner cannot impersonate another assigned approver or skip a prior step.

### 14.3 Record submission correctly

1. Confirm the final approved material and the buyer's current instructions.
2. Submit through the official procurement portal or other required external channel using your organization's authorized process.
3. Retain the official receipt/reference in your organization's records.
4. Open the approved proposal in ProcureAtlas.
5. A manager or higher role selects **Record submission**.
6. Confirm that the proposal, bid and pursuit show submitted status.

**Record submission is an internal record update. It does not upload the proposal to the buyer's portal, send a bid email, apply a legal e-signature, or guarantee acceptance.** Approval alone does not submit the pursuit. The recorded submission transition updates proposal, bid and pursuit together and locks editable work.

After an official result, a manager can record **won** or **lost** in the submitted pursuit's Bid Room. Do not record an outcome solely from a probability or AI suggestion.

## 15. Financial Modeling

### 15.1 Create a cost estimate

1. Open **Financial Modeling → New Estimate**.
2. Select the pursuit and give the estimate a label, such as “Base price — revision 1”.
3. Select the estimate currency.
4. Enter labor, materials, subcontractor, overhead and travel costs.
5. Enter contingency and selling-price margin percentages.
6. Inspect the calculated price and profit.
7. Add relevant hedging notes and save.

Costs must be finite and nonnegative. Contingency is 0–100%; margin is 0% to less than 100%.

### 15.2 Margin is different from markup

```text
Subtotal = sum of recorded costs
Contingency = subtotal × contingency percentage
Total cost = subtotal + contingency
Proposed price = total cost ÷ (1 − margin percentage)
Profit = proposed price − total cost
Markup = profit ÷ total cost
```

Training example: subtotal USD 100,000 and 10% contingency produce cost USD 110,000. At 20% selling-price margin, the proposed price is USD 137,500 and profit is USD 27,500. The equivalent markup is 25%, not 20%.

The form models recorded cost lines, not a complete tax, bond, financing or foreign-exchange accounting system. Include relevant amounts using the appropriate cost lines and your approved financial process.

### 15.3 Exchange rates and comparisons

View existing rates in **Currency Rates**. Managers add/update dated rates through Section 25. A rate states how many units of quote currency equal one unit of base currency.

Comparisons use an applicable recorded rate and date. A missing rate or tender value produces an unknown comparison; do not compare BDT or SGD directly with an unconverted USD tender amount. Award USD totals use known normalized values and do not silently treat every original amount as USD.

## 16. Buyer, award, competitor and partner intelligence

### 16.1 Buyer Intelligence

1. Open **Buyer Intelligence** and use available search/market filters.
2. Open a buyer profile.
3. Inspect sector preferences, recent tenders, incumbents and award history.
4. Use source-linked records to investigate purchasing patterns.

Recorded history describes known catalog data. A frequent supplier or preferred sector is not proof that a buyer will select it again.

### 16.2 Award Intelligence

Use market/sector filters to inspect award counts, known USD totals, averages, winner shares and recent records. Read the known-value coverage note. Awards without a known normalized USD value are excluded from USD value totals/averages/shares, while their original currency/amount may remain visible.

### 16.3 Competitor Intelligence

Open a supplier/competitor profile to inspect wins, sectors, markets, buyers and recorded award history. Private competitor/partner flags and notes are tenant-owned annotations; they are not automatically inherited from global supplier profiles. Where a full annotation editor is unavailable, use the organization's authorized integration process.

### 16.4 Partner / JV Finder

1. Open **Partner / JV Finder**.
2. Inspect the available suggestions and their detail records.
3. Check supported sector, certification, capacity and JV facts.
4. Investigate the supplier independently before any outreach or agreement.

Suggestions are decision support. Missing capacity or relationship evidence remains unknown. Opening a partner card does not establish a JV, invite a partner, send a message or grant another company access to your tenant.

## 17. Markets and connectors

**Markets** provides market configuration/summary information. Market names or coverage listings do not demonstrate that a live feed is currently importing all opportunities from those authorities.

Admins/owners can open **Data Source Connectors** to inspect availability, run history, timestamps, fetched/created counts and errors. A supported **Run** action can trigger its configured source.

The current connector implementation includes guarded demonstration ingestion. Mock records are isolated from production's shared catalog. Some sources/configuration entries are placeholders or are not fully implemented. Do not treat a successful sample run as proof of live CPTU, SAM.gov, UN, ADB, World Bank or other portal synchronization. Ask the operator which production sources are actually configured and verify the freshness of each record you use.

## 18. Alerts and notifications

The top-bar bell opens **Notifications**. The **Alerts** menu currently also routes to this notifications view. Dashboard/pursuit alert summaries and notification read states are related user aids, but marking a notification read is not the same as completing a bid task or resolving an alert condition.

1. Open unread notifications and inspect their content.
2. Mark individual notifications read, or use **Mark all read**.
3. Open **Preferences** to inspect/configure the available notification choices.
4. Address the underlying evidence expiry, deadline, amendment or workflow action in its own module.

Saved preferences do not guarantee that every external email/digest delivery channel is implemented or configured. Check with the operator before relying on notifications as your only deadline reminder.

## 19. Analytics

Open **Analytics** for current tenant aggregates and observed history.

- Current metrics include pursuits, pipeline/won values, win rate and provider usage.
- Daily observations use UTC and the latest 180-day reporting window.
- The worker schedules tenant snapshots at startup and periodically, recording one first observation per tenant/day.
- Legacy seed histories are excluded. Historical charts accumulate as real snapshots are collected.
- Provider usage is identified as a rolling 30-day window.
- Provider cost can show **Unknown** when reliable cost provenance is unavailable.

An empty historical chart is normal in a new deployment. If it stays empty after the worker should have run, ask the operator to inspect scheduled analytics jobs. The application does not backfill previous days from today's values.

Win rate uses recorded won and lost pursuits; no-bid decisions are excluded from that denominator. Pipeline value is recorded estimated opportunity value, not an invoice or revenue forecast. Unknown cost is not equivalent to zero expenditure.

## 20. Billing and usage

Open **Billing & Usage** to inspect the current plan, billing period, seats, usage, provider-token accounting and any stored invoices.

The current standard plan definitions are:

| Plan | Seats | Tracked tenders | Pursuits | API-call allowance | LLM-token allowance |
| --- | --- | --- | --- | --- | --- |
| Free | 1 | 10 | 1 | 100 | 5,000 |
| Solo | 1 | 50 | 5 | 1,000 | 50,000 |
| Professional | 3 | 200 | 20 | 5,000 | 200,000 |
| Bid Team | 10 | 1,000 | 100 | 25,000 | 1,000,000 |

These are application definitions for this edition, not a quotation or contractual promise. Additional legacy/custom plan IDs exist. Use the active subscription and its displayed period/limits to determine your actual allowance. Do not confuse billing-period allowances with hourly API throttling or burst limits.

AI extraction and drafting both consume provider usage. Some usage can remain reserved or estimated while provider confirmation is pending. A failed provider interaction may still represent an admitted call; do not assume only successful drafts are counted.

Production upgrades require verified billing events. The current application does not provide a complete self-service payment checkout flow. Follow your operator's configured billing process. Direct plan-switch controls are for explicitly enabled demo use; they are not a way to grant paid production entitlements. Invoice-list wording is not proof that automatic invoice issuance or payment collection is fully configured.

## 21. API keys, Developer Portal and exports

### 21.1 Create and rotate a key

Admins/owners can manage keys in **Settings** or **Developer Portal → API Keys**.

1. Choose **New Key** or the corresponding create action.
2. Enter a descriptive integration name.
3. Select only the necessary scopes.
4. Copy the complete returned key and store it in your approved secrets manager.
5. Configure the integration and test its intended request.
6. Revoke an unused or compromised key after dependent integrations have been rotated.

Scope meanings:

| Scope | Intended access |
| --- | --- |
| api:read | Read supported versioned API records |
| api:write | Perform supported versioned API writes, including exports where required |
| mcp:read | MCP read integration access where that service is deployed |

An `mcp:read` key alone is not a general REST `api:read` key. Keys are tied to tenant/account access, can expire or be revoked, and must not be placed in URLs, public browser bundles, screenshots or shared documents. Store the full key when it is first issued; list views show a prefix, not a recoverable secret.

### 21.2 Interactive Explorer

1. Open **Developer Portal → Interactive Explorer**.
2. Paste an actual bearer key into the key field.
3. Choose an endpoint and confirm its required scope/method.
4. Supply a real entity ID for paths containing `:id`.
5. Enter query parameters and, for a write, a valid JSON-object body.
6. Run the request and inspect its HTTP status and response.

The Explorer uses versioned `/api/v1/` endpoints and does not substitute your browser session for the entered key. Its usage view reads genuine tenant usage; it does not invent a demonstration chart. Internal UI APIs in Section 25 use session authentication and are a separate interface.

### 21.3 Create and download an export

1. Use an authorized key with the required write scope to request `POST /api/v1/exports`.
2. Set `exportType` and `format`.
3. Inspect the returned status and `downloadUrl`.
4. For a completed artifact, request that URL with the same authorized tenant's bearer header.
5. Save the file in an approved location before the download window expires.

Supported export types include tenders, pursuits, evidence, audit_log, full_backup and awards; formats include JSON and CSV. The current completed-download window is 24 hours. Download also requires tenant-matched authorization. Another tenant cannot use a copied URL, and an expired artifact must be regenerated.

A bearer download is not an anonymous browser hyperlink: use an authenticated integration client or the example below. CSV escaping handles quotes/newlines and spreadsheet-formula prefixes; review any exported private information before sharing it.

```javascript
// Run in a trusted integration environment, not a public browser bundle.
const base = process.env.PA_BASE_URL;
const headers = {
  Authorization: 'Bearer ' + process.env.PA_API_KEY,
  'Content-Type': 'application/json'
};
const result = await fetch(base + '/api/v1/exports', {
  method: 'POST', headers,
  body: JSON.stringify({ exportType: 'pursuits', format: 'csv' })
});
if (!result.ok) throw new Error(await result.text());
const artifact = await result.json();
if (artifact.status !== 'completed' || !artifact.downloadUrl)
  throw new Error('Export is not ready: inspect the returned status/error.');
const download = await fetch(new URL(artifact.downloadUrl, base), { headers });
if (!download.ok) throw new Error(await download.text());
const csv = await download.text();
// Persist csv using your integration's approved file-storage mechanism.
```

Exports can fail explicitly at resource limits. A data export named `full_backup` is not a substitute for an operator's SQLite-consistent database backup plus private-file backups.

## 22. Webhooks and background jobs

### 22.1 Configure an endpoint

Admins/owners use **Webhooks → Endpoints** to add a named receiving URL and supported event subscriptions.

1. Provide a reachable public receiver, preferably HTTPS.
2. Select the events your receiver actually handles.
3. Store the displayed signing secret privately.
4. Use the test action and inspect **Deliveries**.
5. Confirm that the background worker is running if deliveries stay queued.

Private/local destinations and unsafe redirect behavior are restricted. A queued event is not proof of delivery. Receivers should verify the HMAC-SHA256 signature over the exact raw JSON body and handle repeated event IDs idempotently.

Relevant headers are `X-ProcureAtlas-Event`, `X-ProcureAtlas-Event-Id` and `X-ProcureAtlas-Signature`, with a `sha256=` signature prefix. Real pursuit, proposal and approval workflow events use durable jobs, retries, backoff and attempt limits. After repeated failure, an authorized operator must inspect and retry an eligible job.

### 22.2 Inspect jobs

The Webhooks view includes the operational jobs panel. Managers and higher roles can inspect permitted metadata and retry eligible failed jobs. Job inspection does not expose private account-link payloads. Correct the receiving service, scanner or email configuration before retrying; otherwise the same job can fail again.

Invitation/recovery email, upload scanning, webhook processing and analytics collection depend on the separately supervised worker. Inbound integration sources also require operator-configured secrets and tenant bindings. An incoming payload cannot choose an arbitrary tenant.

## 23. Administration and audit

### 23.1 Invite a user

1. Open **Admin Console → Users** with admin/owner access.
2. In **Invite a team member**, enter the email and optional name.
3. Select viewer, contributor, manager or admin.
4. Choose **Send invitation**.
5. Ask the recipient to complete their one-time account link.

Invitations are subject to seat quotas and configured email delivery. Owner promotion is not part of the ordinary invitation form. The initial owner and company provisioning require the organization's authorized setup process.

### 23.2 Maintain user access

Use the user list to inspect role, authenticator status, lock state and login information. Admins/owners can use **Unlock** for an eligible locked account or the deactivate control for an ordinary account. A control depicted with a delete icon performs deactivation and credential revocation; do not assume permanent deletion of all history.

Role changes and administrator password resets are API-assisted where no corresponding editor exists. Owner-related operations remain protected, and the last owner cannot be removed. SCIM supports authorized tenant-scoped user updates/deactivation; complete end-user SSO setup is not included in the current screen workflow.

### 23.3 System and audit views

Admins/owners can open the system tab for stored tenant counts, usage/storage information and recent connector activity. **Audit Log** records consequential actions with actor, entity and time information. API-key actors are distinguished from user IDs.

Use audit records to investigate an unexpected role change, proposal status or evidence review. Do not treat the screen as a complete infrastructure monitor or immutable external compliance archive. Use the organization's retention and independent audit-backup process where required.

## 24. Troubleshooting and operating checklists

### 24.1 Common problems

| Problem | Likely cause | What to do |
| --- | --- | --- |
| Session expired / 401 | Idle/absolute expiry or revoked credentials | Preserve unsaved text and sign in again |
| Permission denied / 403 | Insufficient role, scope or assigned-approver mismatch | Check role/scopes/assignment with your administrator |
| Not found / 404 | Wrong ID, removed record or inaccessible tenant record | Open the item from your own workspace list and check its ID |
| Conflict / 409 | Stale revision, invalid stage, completed review or locked work | Reload current data, reconcile edits and use the allowed transition |
| Validation error / 400 | Invalid body, numeric amount, dates, currency or evidence | Correct the field; do not repeatedly submit the same input |
| Rate/quota limit / 429 | Too many requests or exhausted allowance | Observe Retry-After and inspect Billing & Usage |
| Upload stays quarantined | Worker/scanner unavailable or failed scan | Check status and ask the operator to inspect the job |
| Evidence missing from a selector | Unverified, expired, wrong-category or future-dated record | Have a manager correct/review the evidence |
| Compliance looks complete but approval fails | Mandatory unknown/failure, invalid evidence, incomplete tasks or section review | Check every gate, not only coverage percentage |
| Approval step cannot be decided | Earlier step pending, wrong assigned user, invalid chain or readiness failure | Resolve the exact condition and retry with the eligible approver |
| AI Draft fails | Missing provider configuration/quota, evidence gaps, invalid citations or concurrent edits | Inspect the error, verify evidence and avoid concurrent edits |
| Proposal text is not saved | Blur did not occur, save pending, request failure or stale revision | Wait, use Retry save, or reload/reconcile while keeping local text |
| Search has few/no results | Short/broad query, bounded results or filters | Use at least two characters, refine the phrase and inspect module filters |
| Analytics history is empty | No genuine snapshot yet or worker not running | Allow collection time; inspect analytics jobs |
| Export download fails | Wrong tenant/key, expired window, incomplete artifact or unavailable storage | Check authorization/status; regenerate an expired artifact |
| Upgrade button is rejected | Production billing verification is required | Follow the configured billing process |

Some views can show a generic not-found/empty message after a loading failure. Check the shared API error notice before treating the message as proof that a record was deleted. If an error persists, record the module, action, time/timezone, HTTP status and record ID for support. Do not send passwords, API keys, authenticator secrets or account-link tokens with the report.

### 24.2 Daily researcher checklist

- Review Command Center and unread notifications.
- Search active opportunities in the relevant markets/sectors.
- Confirm important deadlines and amendments at the source.
- Add promising opportunities to the pursuit process with the proper role.
- Flag missing source information or stale intelligence.

### 24.3 Proposal author checklist

- Confirm the pursuit is bidding and uses the correct company.
- Use current, verified evidence appropriate to each claim.
- Resolve mandatory compliance with the manager.
- Complete recorded tasks and the real-world preparation checklist.
- Review AI-generated statements, citations and gaps.
- Wait for saved changes and save a meaningful version.
- Avoid editing the same section concurrently with another author.

### 24.4 Reviewer and submission checklist

- Recheck the latest source requirements and deadline.
- Review every section and its evidence references.
- Verify financial calculations, currencies and commercial approvals.
- Confirm mandatory checks pass and all required tasks are done.
- Complete assigned chain steps in order.
- Submit through the buyer's official channel and retain its receipt.
- Record submission in ProcureAtlas and confirm all three workflow states.
- Track the outcome without confusing probabilities with results.

## 25. Advanced appendix: API-assisted workflow actions

This section is for authorized users/operators who need actions without complete screen editors. It uses the application's **internal session-authenticated APIs**, not the versioned bearer Explorer. Use it only on your organization's trusted ProcureAtlas origin and with the correct signed-in role. These examples are instructions, not actions performed by this manual.

Open your browser developer console on the application and define the helper below. It sends your existing same-origin session; it does not require copying a session cookie or API key.

```javascript
async function paRequest(path, method = 'GET', body) {
  if (!path.startsWith('/api/')) throw new Error('Use a local application API path');
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(response.status + ': ' + (data.error || 'Request failed'));
  return data;
}
```

Replace every `REPLACE_...` placeholder with an actual record from your own tenant. Read the existing record first. Do not substitute fabricated IDs, thresholds or business claims. Numbers in the examples are training values and must be replaced with reviewed facts.

### 25.1 Inspect the company and evidence IDs

```javascript
const company = await paRequest('/api/company');
console.table(company.evidence.map(e => ({
  id: e.id, title: e.title, verified: e.verified, expiresAt: e.expiresAt
})));
```

### 25.2 Verify reviewed financial evidence — manager or higher

After actually reviewing the document and its period, issuer and amount:

```javascript
await paRequest('/api/company/evidence', 'PATCH', {
  id: 'REPLACE_EVIDENCE_ID',
  verified: true,
  factMetric: 'annual_turnover',
  factAmount: 500000,
  factCurrency: 'USD',
  factUnit: 'money'
});
```

For other evidence, verify only facts the record supports. The same endpoint can record `verified: false` when an authorized reviewer withdraws verification. This can reset editable approvals/readiness. Reload Company Brain and affected work afterward.

### 25.3 Create a company-specific pursuit — contributor or higher

```javascript
const pursuit = await paRequest('/api/pursuits', 'POST', {
  tenderId: 'REPLACE_TENDER_ID',
  companyId: 'REPLACE_COMPANY_ID'
});
console.log(pursuit.id);
```

For stage updates, managers use the current stage as `expectedStage`; do not guess it or send a direct submitted transition.

### 25.4 Attach compliance evidence — contributor or higher

Read the existing matrix to obtain a canonical requirement ID:

```javascript
const pursuitId = 'REPLACE_PURSUIT_ID';
const compliance = await paRequest('/api/pursuits/' + pursuitId + '/compliance');
console.table(compliance.items.map(item => ({
  requirementId: item.requirement.id,
  criterion: item.requirement.criterion,
  status: item.status
})));

await paRequest('/api/pursuits/' + pursuitId + '/compliance', 'PATCH', {
  requirementId: 'REPLACE_REQUIREMENT_ID',
  evidenceId: 'REPLACE_EVIDENCE_ID',
  status: 'compliant',
  notes: 'Reviewed against the actual source clause and supporting document.'
});
```

Use partial/gap when appropriate. Compliant requires current, verified evidence from the pursuit's company. Do not use N/A to evade a mandatory criterion. Updating the row resets consequential review state for editable work; reload the matrix and proposal.

### 25.5 Attach evidence to a manual proposal section — contributor or higher

```javascript
const proposalId = 'REPLACE_PROPOSAL_ID';
const proposal = await paRequest('/api/proposals/' + proposalId);
const section = proposal.sections.find(s => s.id === 'REPLACE_SECTION_ID');
if (!section) throw new Error('Section not found in this proposal');

await paRequest('/api/proposals/' + proposalId + '/sections/' + section.id, 'PATCH', {
  expectedRevision: section.revision,
  content: 'REPLACE_WITH_REVIEWED_TEXT [evidence:REPLACE_EVIDENCE_ID]',
  evidenceIds: ['REPLACE_EVIDENCE_ID'],
  status: 'drafting'
});
```

Use evidence appropriate to this section's factual claims; a turnover statement alone does not substantiate a project reference or a certification. Reload the editor after this update so its revision is current. A manager then performs the human section review in the interface. Do not run the API write while another unsaved editor is active.

### 25.6 Configure an assigned approval chain — admin or owner

Create the intended chain before creating proposals. Inspect existing chains first to avoid adding unintended duplicate active chains.

```javascript
console.log(await paRequest('/api/approval-chains'));

await paRequest('/api/approval-chains', 'POST', {
  name: 'Submission review',
  triggerType: 'submission',
  slaHours: 48,
  steps: [
    { order: 1, role: 'manager', approverEmail: 'REPLACE_MANAGER_EMAIL' },
    { order: 2, role: 'owner', approverEmail: 'REPLACE_OWNER_EMAIL' }
  ]
});
```

The users must exist in your tenant and have the required roles. Existing chain updates use `PATCH /api/approval-chains` with the chain ID and permitted fields such as steps or isActive. Consult [API_SPEC.md](API_SPEC.md) and the current route schemas before changing an active process.

### 25.7 Add a dated exchange rate — manager or higher

```javascript
await paRequest('/api/currency-rates', 'POST', {
  baseCurrency: 'USD',
  quoteCurrency: 'BDT',
  rate: 120,
  rateDate: '2026-10-10',
  source: 'REPLACE_WITH_ACTUAL_REVIEWED_RATE_SOURCE'
});
```

The training example means one USD equals 120 BDT; it is **not** a claim about the actual rate on that date. Replace amount, date and source with the approved rate. Review implications before changing a rate used in eligibility or price comparisons.

## 26. Deployment appendix for operators

This is an operational reference, separate from daily user actions. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full deployment procedure.

### 26.1 Runtime and service requirements

- Node.js 22.13 or newer; Node.js 24 is recommended.
- Installed project dependencies and a generated matching Prisma client.
- Persistent SQLite database and private upload/export volumes.
- A separately supervised worker for jobs and real analytics observations.
- ClamAV with current definitions for safe file release.
- Configured AI provider access if extraction/drafting is required.
- Configured email delivery and HTTPS application origin for invitations/recovery.
- Chrome or Edge for the release browser gate; use CHROME_PATH for a nonstandard executable location.

### 26.2 Portable commands

Run from the project root:

```text
npm ci
npm run db:generate
npm run db:check
npm run deploy:prepare
npm start
```

Run the worker in a separate supervised process:

```text
npm run worker
```

For development, use `npm run dev`. For verification alone, use `npm run release:verify`. Build alone is `npm run build`. Database deployment alone is `npm run db:deploy`; it does not independently run the full release gate.

Deployment preparation runs types, tests, production build, disposable two-tenant HTTP workflows, headless browser checks and platform smoke checks before applying reviewed migrations. It does not publish the site or start persistent services. Normal build/start commands do not push or reset the database schema.

### 26.3 Production configuration

The operator must configure the database/storage locations, provider credentials and secrets through the approved environment/secrets mechanism. Relevant options include DATABASE_URL, UPLOAD_DIR, EXPORT_DIR, CLAMAV_COMMAND, APP_ORIGIN, APP_ENCRYPTION_KEY, RESEND_API_KEY and ACCOUNT_EMAIL_FROM. Inbound webhook processing additionally requires the source-secret and tenant-binding maps. Billing requires the operator's verified provider configuration.

APP_ENCRYPTION_KEY is a protected base64-encoded 32-byte key used for encrypted account-related material. Keep it stable and backed up. Changing it without a migration can make existing encrypted MFA/email data unreadable.

Disable DEMO_MODE, DEMO_BILLING_SWITCHING and NEXT_PUBLIC_DEMO_MODE for production. Relative database paths resolve from the project's prisma directory. Do not expose upload/export directories through public static hosting.

### 26.4 Backups and release checks

Use reviewed versioned SQL migrations. Deployment checks known schema/history, migration checksums and database integrity; it creates a SQLite-consistent backup before altering an existing database and applies changes transactionally. Preserve the printed backup until the release is verified.

Back up private files and the stable encryption key through the organization's protected process as well. A database backup alone does not include uploaded files or export artifacts. Stop writers and follow an explicit recovery procedure before restoring a backup. Do not use schema push/reset or demo seeding as a production upgrade procedure.

The recorded workspace release passed types, 468 tests in 65 files, the production build, 90 real two-tenant HTTP checks and browser/platform smoke checks. This is a dated verification record, not a guarantee that later changes or a different production environment will pass. Rerun the gate for the release you deploy.

## 27. Glossary and reference files

| Term | Meaning |
| --- | --- |
| Tenant | Organization-scoped workspace |
| Tender | Catalog opportunity/notice with source information |
| Tender Digital Twin | Consolidated detail view of that tender |
| Pursuit | Your company's tracked effort to qualify/bid for a tender |
| Bid Room | Operational detail view of a pursuit |
| Evidence | Stored support for a factual company claim |
| Verification | Human review of an evidence record and relevant facts |
| Capability fact | An explicit company/supplier capability linked to supporting evidence |
| Eligibility | Evaluation of required qualifications against supported facts |
| Opportunity fit | Decision-support assessment of commercial/company fit |
| Compliance item | Saved requirement status and evidence link for a pursuit |
| Proposal section | A component of the written bid response |
| Proposal version | A saved snapshot of sections and evidence references |
| Approval chain | Ordered role/assignment-based decision steps |
| Recorded submission | Internal workflow state after authorized submission/readiness checks |
| Outbox/worker | Durable job records and the process that executes them |
| Normalized USD value | Original monetary data converted with recorded provenance where available |
| Unknown | The application lacks sufficient supported information; it is not an automatic pass |

Useful repository references:

- [Deployment guide](DEPLOYMENT.md)
- [Release implementation and verification](RELEASE_STEPS_51_TO_57.md)
- [Pursuit/compliance/proposal workflow behavior](WORKFLOW_STEPS_21_TO_30.md)
- [Accounts, uploads, exports and worker behavior](PLATFORM_STEPS_41_TO_50.md)
- [API specification](API_SPEC.md)
- [Security guidance](SECURITY.md)

Some older architectural/product documents describe planned features or earlier implementations. For operational behavior, use this edition, the current screens/API validation, and the current deployment guide together.
