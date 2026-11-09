# Demo script (3 minutes, plus 90 seconds on data and 30 seconds on day one)

For Tushar: a customer-success leader, not an engineer. Talk about the customer, the timeline and trust. Skip how the code works unless he asks.

Before the call: open https://integration-scoping-demo.vercel.app/, have Halden Outfitters selected, close other tabs. Do one dry run so everything is warm. Leave **Show evidence** off.

---

## 0:00 Setup (20 seconds)

**Do:** Nothing yet. The Halden Outfitters kickoff card is showing: the goal, their six tools, and what the tool produces.

**Say:**
> "When a new customer signs, the first week decides whether the 30-day promise holds. Someone has to work out what to connect, who to ask for access, and what could go wrong with the data. I built a small tool for that first week. This is a fictional customer, Halden Outfitters. They run six tools and want a board-ready risk figure in 30 days."

## 0:20 The summary (40 seconds)

**Do:** Click **Build scoping plan**. Let the summary card sit on screen.

**Say:**
> "This is the first thing I'd want as the person accountable for that 30 days. Four of the six tools can be connected now. Two need a decision from SAFE. Halden owes us ten answers. And the data isn't ready to feed a risk number yet: three things are blocking it. Underneath is exactly what stands in the way, and whose move it is: SAFE's, the customer's, or ours."

## 1:00 Who owes what (45 seconds)

**Do:** Click **See who owes what, with emails ready to send**. Point at the **Vulnerability management lead** card. Click **Copy email**, then **Preview email**.

**Say:**
> "Here it's turned into actions, one card per person. The Tenable owner gets an email that's ready to send: what access we need, a dedicated account, and a question about why their console shows two more assets than the export. Nobody writes this from scratch. And the email only contains details that were checked against Tenable's own documentation. For CrowdStrike, where I didn't have the docs, it doesn't guess. It says we'll confirm and follow up."

**Do:** Point at the **SAFE platform team** card.

**Say:**
> "And these are the questions for us internally: which Defender product, and whether a Snyk connector exists beyond the public list."

## 1:45 Trust: show the evidence (50 seconds)

**Do:** Click the **Plan** tab. Scroll to **Custom work scoping sheet: Snyk**. Turn on **Show evidence**. Click the source chip next to **Rate limits**. The drawer opens on the exact line.

**Say:**
> "By default it reads like a customer document. If someone asks 'where did that come from?', I flip this on. Every technical detail has a source, and the code checks it against the vendor's documentation. The AI writes the sentences, but it isn't trusted on facts. If it invents an endpoint or gets a number wrong, that line is held back and shows as Confirm. I tested that by planting 18 kinds of mistakes, and it caught all of them."

**Do:** Close the drawer. Point at **Versioning: Confirm**.

**Say (optional, 15 seconds):**
> "This one is real, not planted. The AI's sentence was right, but it labelled one of its sources wrong, so the check held the line back. I'd rather show a Confirm than a fact I can't trace."

## 2:35 Export (25 seconds)

**Do:** Turn **Show evidence** off. Click **Export**, then **Customer plan (PDF)**.

**Say:**
> "One click gives the customer a clean plan to sign off on, and there's an internal handoff for the platform team with every open item."

**Stop here if time is short (3:00).**

---

## Optional: a different goal (20 seconds)

**Do:** Click **Edit** in the customer bar, click the **Fix the most exploitable exposures** preset, then **Rebuild plan**.

**Say:**
> "The goal shapes the plan. For fixing exposures, the ticketing tool moves up to step two, because fixes have to reach the team that owns them, and the questions change to fix deadlines and owners. The rules for each goal live in a config file too."

**Do:** Click **Edit** again, choose **Board-ready risk figure**, and **Rebuild plan** to return to the main story.

## 3:00 Data readiness (90 seconds)

**Do:** Click the **Data readiness** tab.

**Say:**
> "Oliver said two things happen on every deployment: messy data and a tight timeline. These are sample exports, synthetic, with problems I planted on purpose. The headline is the red box: not ready for a risk number yet, and why."

**Do:** Scroll to **Merged assets** and point at `ip-10-0-1-15 / web-prod-01`.

**Say:**
> "The scanner calls this server by its AWS name, and the endpoint tool calls it web-prod-01. Different names, but the same cloud instance ID, so it merges, and it shows why."

**Do:** Scroll up to **Possible duplicates**. Point at the two `app-01` records.

**Say:**
> "Two different servers are both called app-01. Merging them would hide a machine from the risk figure. Their instance IDs differ, so it doesn't merge. It asks a person."

**Do:** Click **Different machines** on app-01 and **Same machine: merge** on fileserver-02. Then click **Plan** and point at the summary.

**Say:**
> "The person decides, and the summary updates. On the sample data it made zero wrong merges, and everything it wasn't sure about went to a person."

## 4:30 Day one (30 seconds)

**Do:** Click the integrations list button in the header ("SAFE public list · 105 integrations"), then **Use simulated internal list**.

**Say:**
> "Last thing. Everything SAFE-specific lives in config files: the integrations list, the ordering rules, the template, the data model. Say SAFE's internal list includes Snyk. I load that file..."

**Do:** Point at the green banner: "Snyk: Custom work → Out of the box".

**Say:**
> "...and Snyk moves to out of the box, the summary updates, and the custom work disappears. No code change. On day one I'd swap in SAFE's real list and template, and the tool works your way."

---

## If he asks

- **"Is this real customer data?"** No. It's a fictional customer and synthetic exports, and only public vendor docs are used.
- **"How accurate is it?"** It catches the 18 kinds of mistakes I planted, and it made zero wrong merges on the sample data. That's a proof of concept on public docs, not a benchmark. With real customers I'd measure it against SAFE's own gold sets.
- **"Can it tell me how long onboarding will take?"** Not honestly, without SAFE's own history. Effort comes from a config file and is shown as a placeholder. I didn't want it to invent a timeline.
- **"Does it know our connectors?"** No. It only knows the public integrations page. That's why it says Confirm, and why the config swap matters.
- **"Which AI?"** Claude drafts the wording. Code does the matching, the ordering, every check, the summary and the emails.
