# Demo script (about 4 minutes)

Before the call: open https://integration-scoping-demo.vercel.app/ and hard-refresh it. Halden Outfitters selected, **Show evidence** off, other tabs closed. Do one full dry run, then reload the page so every decision is cleared.

---

## Part 1: the setup (kickoff card)

[Kickoff card on screen]
"When a customer signs, the first week decides whether the 30-day promise holds. Someone has to work out what to connect, who to ask for access, and what's wrong with the data. This tool does that first week. The customer is fictional: Halden Outfitters, six security tools, and one goal: a board-ready risk figure within 30 days."

## Part 2: where things stand

[Click **Build scoping plan**. Point at the headline]
"This is what a customer-success lead wants first. Four of the six tools can be connected now. Before the risk figure can be trusted, SAFE has four things to confirm, Halden owes us eleven answers, and three data issues need clearing. Every number here is counted by code, not written by the AI."

[Point at the list under **What stands between**]
"And each blocker says whose move it is: SAFE's, the customer's, or ours."

## Part 3: who owes what

[Click **See who owes what, with emails ready to send**. On the **Vulnerability management lead** card, click **Preview email**, then **Copy email**]
"The same items, grouped by the person who has to act. The Tenable owner gets an email ready to send: the access we need, a dedicated account, and why their console shows 22 assets when our export returned 20. It's built only from details checked against Tenable's docs."

[Point at the **Endpoint security (EDR) administrator** card]
"For CrowdStrike I had no vendor docs, so it doesn't guess. It says we'll confirm the access and follow up."

[Point at the **SAFE platform team** card]
"And these are SAFE's own calls: which Defender product Halden means, and whether a Snyk connector exists beyond the public list."

## Part 4: the plan and its evidence

[Click the **Plan** tab. Scroll past **Coverage check** and **Connection order** to the Snyk scoping sheet. Turn on **Show evidence**. Click the source chip next to **Rate limits**]
"The plan reads like a customer document. Turn this on and every technical detail shows its source. This opens Snyk's own docs at the exact line: 1,620 requests per minute."

[Close the drawer]
"The AI writes the sentences, but code checks every fact: endpoints and scopes against the vendor's API spec, quotes against the exact line. If anything fails, the whole line is held back as Confirm, and the AI never gets a second try. I planted 18 kinds of mistakes, and it caught all 18."

## Part 5: verification

[Click the **Verification** tab. Point at **Held back**]
"Seventy facts, sixty-nine verified. This one wasn't planted. The Snyk versioning sentence was mostly right, but the AI filed a header name as an API version, so the line was held back. I'd rather show a Confirm than a fact I can't trace."

[Click the source chip next to `YYYY-MM-DD` in the table]
"The facts that did pass still open their source."

"One precise point: verified means it's in the vendor's docs. Whether SAFE's connector needs exactly that access is what SAFE confirms, and the plan asks."

## Part 6: data readiness

[Click the **Data readiness** tab. Point at the red box]
"Now the data. These are synthetic exports with problems I planted. Three things block: Tenable returned two fewer assets than its console shows, four possible duplicates need a person, and two findings point to machines no tool reports."

[Scroll to **Merged assets**. Point at `ip-10-0-1-15 / web-prod-01`]
"The scanner and the endpoint tool name this server differently. Same cloud instance ID, so it merges, and it says why."

[Scroll up to **Possible duplicates**. On the `hal-lt-005` / `hal-lt-009` pair, click **Same machine: merge**]
"Weak evidence never merges on its own. These two laptops share only an IP address, and their serial numbers differ. If I try to merge them anyway, it stops me and asks again."

[Click **Cancel**, then **Different machines**. Click **Different machines** on `app-01`, **Same machine: merge** on `fileserver-02` and on `hal-lt-008`]
"A person decides each pair, and the gate updates. Zero wrong merges on the sample data. The two blockers left need Halden's answers, which is exactly what the Tenable email asks."

## Part 7: the two documents

[Click the **Internal handoff** tab. Scroll to **Every Confirm item**]
"It produces two documents. This one is for SAFE's team: every open item and who resolves it, what the verifier held back, and the data work. Effort is left blank on purpose. I won't invent a timeline without SAFE's own history."

[Click **Export**, then **Customer plan (PDF)**]
"The customer gets a clean plan: only verified details and their questions."

## Part 8: day one, no code change

[Click **SAFE public list · 105 integrations** in the header, then **Use simulated internal list**. Point at the green banner]
"Everything SAFE-specific is a config file: the integrations list, the ordering rules, the template, the data rules. Say SAFE's internal list includes Snyk. I load it, and Snyk moves from custom work to out of the box, its scoping sheet disappears, and the summary updates. On day one I'd swap in SAFE's real files."

## Part 9: the goal shapes the plan

[Click **Edit** in the customer bar. Choose **Who has access to what**. Click **Rebuild plan**]
"Last thing: the goal drives the plan. For an access review, only Okta and the endpoint tools are needed. Tenable, ServiceNow and Snyk move to 'connect later' and drop out of the counts and the emails. The ordering, the questions and the data gate all follow the goal, and those rules are config too."

[Back on the summary]
"So in week one: what to connect, who owes what, and whether the data can be trusted, with every fact traceable and every gap named."

---

## Backup answers (only if asked)

- **"Is this real data?"** No. A fictional customer, synthetic exports, and only public vendor docs plus SAFE's public integrations page.
- **"How accurate is it?"** 18 of 18 planted errors caught, 11 of 11 coverage cases right, zero wrong merges on the sample data. A proof of concept, not a benchmark. With real customers I'd measure it against SAFE's own past scopes.
- **"Does it know our connectors?"** No. "Not on the public list" means "confirm with SAFE", never "SAFE can't do it". That's why the config swap matters.
- **"Where do the Tenable facts come from?"** A notes file compiled from Tenable's developer docs, with the source URLs in it. Okta and Snyk are checked against their full API specs.
- **"Where does 22 in the console come from?"** It's in the sample data. In a real rollout it's the customer's answer to the Tenable email.
- **"Are the review decisions saved?"** Not yet. They live in the browser. A real version would record who decided and when.
- **"Which AI?"** Claude writes the wording. Code does the matching, ordering, every check, the counts and the emails.
