# Demo script (3 minutes, plus 90 seconds on data and 30 seconds on day one)

For Tushar: a customer-success leader, not an engineer. Talk about the customer, the timeline and trust. Skip how the code works unless he asks.

Before the call: open the app, have Halden Outfitters selected, close any other tabs. Do one dry run so everything is warm.

---

## 0:00 Setup (20 seconds)

**Do:** Nothing yet. The Halden Outfitters screen is showing.

**Say:**
> "When a new customer signs, the first week decides whether the 30-day promise holds. Someone has to work out what to connect, who to ask for access, and what could go wrong with the data. I built a small tool for that first week. This is a fictional customer, Halden Outfitters. They run six tools and they want a board-ready risk figure in 30 days."

## 0:20 Build the plan (20 seconds)

**Do:** Click **Build scoping plan**.

**Say:**
> "This builds a one-page plan the customer could sign off on. It runs on public docs only, so anywhere SAFE's internal knowledge would be better, it says Confirm instead of guessing."

## 0:40 Coverage (35 seconds)

**Do:** Point at the coverage table.

**Say:**
> "First, coverage. Four tools are out of the box. Microsoft Defender is the classic one: the customer says 'we use Defender', and SAFE lists five different Defender products. So it doesn't guess. It goes to 'Confirm with SAFE', and the exact question for the customer is already at the bottom of the plan. Snyk isn't on SAFE's public list, so it's marked custom work, with a note to confirm with SAFE first, because the public page shows 105 integrations and SAFE says it has more than 150."

## 1:15 Order and access (30 seconds)

**Do:** Scroll to **Connection order**, then **Access checklist**.

**Say:**
> "Then the order: scanner and endpoint data first, because nothing downstream means anything without it. Then identity, then ticketing. Tools still waiting on a decision go last. And the access checklist says what we need and which person on their side owns it, ready to paste into an email. For CrowdStrike and ServiceNow I didn't have the vendor docs, so it says Confirm rather than making something up."

## 1:45 The Snyk sheet and a citation (40 seconds)

**Do:** Scroll to **Custom work scoping sheet: Snyk**. Click the source chip next to **Rate limits** (or **Endpoints**). The drawer opens on the exact line.

**Say:**
> "For the custom one, it drafts a scoping sheet for the connector: base URL, versioning, authentication, endpoints, rate limits, and the fields to map. Here's the part that matters for trust. Every technical detail has a source, and the code checks it against the vendor's own documentation. The AI writes the sentences, but it isn't trusted on facts. If it invents an endpoint or gets a number wrong, that line is held back and shows as Confirm. I tested that by planting 18 kinds of mistakes, and it caught all of them."

**Do:** Close the drawer. Point at **Versioning: Confirm** in the same sheet.

**Say (optional, 15 seconds):**
> "This one is real, not planted. The AI's sentence was right, but it labelled one of its sources wrong, so the check held the line back. I'd rather show a Confirm than a fact I can't trace."

**Do:** Point at **How records relate to assets: Confirm**.

**Say:**
> "And this one it can't know from docs, so it's an open item with the customer."

## 2:25 Open questions and export (35 seconds)

**Do:** Scroll to **Open questions**. Then click **Customer plan (PDF)** in the left panel.

**Say:**
> "It ends with the questions we still need answered: which Defender, which Snyk region, who owns each admin account, what counts as critical. Then one click gives a clean document for the customer, plus an internal handoff for the platform team with everything still to confirm."

**Stop here if time is short (3:00).**

---

## 3:00 Data readiness (90 seconds)

**Do:** Click the **Data readiness** tab.

**Say:**
> "Oliver said two things happen on every deployment: the data is messy and the timeline is tight. So this runs the checks on sample exports. They're synthetic, with problems I planted on purpose. The headline is this red box: it's not ready to feed a risk number yet. The counts don't match what the customer's Tenable console shows, there are findings pointing at assets nobody reports, and there are possible duplicates a person needs to decide on."

**Do:** Scroll to **Merged assets** and point at `ip-10-0-1-15 / web-prod-01`.

**Say:**
> "Here the scanner calls a server by its AWS name and the endpoint tool calls it web-prod-01. Different names, but the same cloud instance ID, so it merges with high confidence, and it shows why."

**Do:** Scroll up to **Possible duplicates**. Point at the two `app-01` records.

**Say:**
> "And here are two servers both called app-01. A naive merge would combine them and hide a machine from the risk figure. Their instance IDs are different, so it doesn't merge. It asks a person."

**Do:** Click **Different machines** on the app-01 item, and **Same machine: merge** on fileserver-02.

**Say:**
> "The person decides, and the queue updates. On the sample data it made zero wrong merges, and everything it wasn't sure about went to a person."

## 4:30 Day one (30 seconds)

**Do:** Go back to **Scoping plan**. Click **Use simulated internal list** in the header (or **Load config file** and pick a JSON file).

**Say:**
> "Last thing. Everything SAFE-specific lives in config files: the integrations list, the ordering rules, the template, the data model. Say SAFE's internal list includes Snyk. I load that file..."

**Do:** Point at the green banner: "Snyk: Custom work → Out of the box". The Snyk custom sheet is gone.

**Say:**
> "...and Snyk moves to out of the box, and the custom work disappears. No code change. On day one I'd swap in SAFE's real list and template, and the tool works your way."

---

## If he asks

- **"Is this real customer data?"** No. It's a fictional customer and synthetic exports. Only public vendor docs are used.
- **"How accurate is it?"** The checks catch the 18 kinds of mistakes I planted, and it made zero wrong merges on the sample data. That's a proof of concept on public docs, not a benchmark. On real customers I'd measure it against SAFE's own gold sets.
- **"Does it know our connectors?"** No. It only knows the public integrations page. That's why it says Confirm, and why the config swap matters.
- **"Which AI?"** Claude drafts the wording. Code does the matching, the ordering and every check.
