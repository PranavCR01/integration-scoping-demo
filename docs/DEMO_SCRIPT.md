# Demo script (about 4 minutes: roughly 660 spoken words plus clicks)

Before the call: open https://integration-scoping-demo.vercel.app/ and hard-refresh it. Halden Outfitters selected, **Show evidence** off, other tabs closed. Do one full dry run, then reload the page so every decision is cleared.

---

## Part 0: what the tool is (before you share the screen, 20 seconds)

"I built Integration Scoping, a tool for a forward deployed engineer's first week with a new customer. You give it the customer's tools and their goal. It tells you which tools SAFE connects out of the box, what to connect first, who on the customer side to ask for which access, and whether their data is ready to trust. The AI only writes the wording. Code checks every fact against the vendor's docs and runs every data check."

## Part 1: the setup (kickoff card)

[Share the screen. Kickoff card on screen]
"That first week decides whether the 30-day promise holds. Here's a fictional customer, Halden Outfitters: six security tools, and a board-ready risk figure due in 30 days."

[Point at **Plan rules: Board-ready risk figure** under the goal, and the **Try another goal** options]
"The goal picks a rule set. Code matches its words, here 'board' and 'risk figure'. There are five rule sets, and each one sets which tools are needed, the connection order, the questions, the summary line and what blocks the data. I'll switch it at the end."

## Part 2: where things stand

[Click **Build scoping plan**. Point at the headline]
"Where things stand: four of six tools can connect now. SAFE has four things to confirm, Halden owes eleven answers, and three data issues block the risk figure. Every number is counted by code, not written by the AI."

[Point at the list under **What stands between**]
"Each blocker says whose move it is."

## Part 3: who owes what

[Click **See who owes what, with emails ready to send**. On the **Vulnerability management lead** card, click **Preview email**, then **Copy email**]
"The same items, one card per person. The Tenable owner gets a ready email: the access we need, a dedicated account, and why their console shows 22 assets when our export returned 20. Every detail in it was checked against Tenable's docs."

[Point at the **Endpoint security (EDR) administrator** card]
"No CrowdStrike docs on file, so it doesn't guess: it says we'll confirm and follow up."

[Point at the **SAFE platform team** card]
"And SAFE's own calls: which Defender product, and whether a Snyk connector exists."

## Part 4: the plan and its evidence

[Click the **Plan** tab. Scroll past **Coverage check** and **Connection order** to the Snyk scoping sheet. Turn on **Show evidence**. Click the source chip next to **Rate limits**]
"The plan reads like a customer document. Turn this on and every detail shows its source: here, Snyk's docs at the exact line."

[Close the drawer]
"The AI writes sentences; code checks every fact against the vendor's API spec or the exact doc line. If anything fails, the line becomes Confirm, with no second try. I planted 18 kinds of mistakes, and it caught all 18."

## Part 5: verification

[Click the **Verification** tab. Point at **Held back**]
"Sixty-nine of seventy verified. This hold wasn't planted: the AI filed a header name as an API version, so the line was held back. I'd rather show Confirm than a fact I can't trace."

[Click the source chip next to `YYYY-MM-DD` in the table]
"The facts that did pass still open their source."

"To be precise: verified means it's in the vendor's docs. What SAFE's connector needs is SAFE's to confirm, and the plan asks."

## Part 6: data readiness

[Click the **Data readiness** tab. Point at the red box]
"Now the data: synthetic exports with planted problems. Three things block: two Tenable assets missing, four possible duplicates, and two findings pointing at machines no tool reports."

[Scroll to **Merged assets**. Point at `ip-10-0-1-15 / web-prod-01`]
"Two tools, two names, one cloud instance ID: merged, with the reason shown."

[Scroll up to **Possible duplicates**. On the `hal-lt-005` / `hal-lt-009` pair, click **Same machine: merge**]
"Weak evidence never merges on its own. These laptops share only an IP, and their serials differ, so if I force it, it asks again."

[Click **Cancel**, then **Different machines** on that pair. Click **Different machines** on `app-01`, **Same machine: merge** on `fileserver-02` and on `hal-lt-008`]
"A person decides, the gate updates: zero wrong merges. The two blockers left need Halden's answers, which the Tenable email already asks for."

## Part 7: the two documents

[Click the **Internal handoff** tab. Scroll to **Every Confirm item**]
"Two documents. The internal handoff: every open item with who resolves it, the held-back line, the data work. Effort isn't estimated, on purpose: no timeline without SAFE's own history."

[Click **Export**, then **Customer plan (PDF)**]
"The customer gets a clean plan with only verified details."

## Part 8: day one, no code change

[Click **SAFE public list · 105 integrations** in the header, then **Use simulated internal list**. Point at the green banner]
"Everything SAFE-specific is a config file. Say SAFE's internal list includes Snyk: I load it, Snyk moves to out of the box, and its build sheet disappears, with its 40 facts, which is why verification now reads 30 of 30. No code change. On day one I'd load SAFE's real files."

## Part 9: the goal shapes the plan

[Click **Edit** in the customer bar. Choose **Who has access to what**. Click **Rebuild plan**]
"Last, the goal switch I promised. For an access review, only Okta and the endpoint tools matter, and Okta moves to step one. Tenable, ServiceNow and Snyk move to 'connect later' and drop out of the counts and emails, the questions change, and their data problems become warnings instead of blockers. Those rules are config too."

[Back on the summary]
"So, week one: what to connect, who owes what, and whether the data can be trusted, with every fact traceable and every gap named."

---

## Backup answers (only if asked)

- **"Is this real data?"** No. A fictional customer, synthetic exports, and only public vendor docs plus SAFE's public integrations page.
- **"How accurate is it?"** 18 of 18 planted errors caught, 11 of 11 coverage cases right, zero wrong merges on the sample data. A proof of concept, not a benchmark. With real customers I'd measure it against SAFE's own past scopes.
- **"Does it know our connectors?"** No. "Not on the public list" means "confirm with SAFE", never "SAFE can't do it". That's why the config swap matters.
- **"Where do the Tenable facts come from?"** A notes file compiled from Tenable's developer docs, with the source URLs in it. Okta and Snyk are checked against their full API specs.
- **"Where does 22 in the console come from?"** It's in the sample data. In a real rollout it's the customer's answer to the Tenable email.
- **"Are the review decisions saved?"** Not yet. They live in the browser. A real version would record who decided and when.
- **"Which AI?"** Claude writes the wording. Code does the matching, ordering, every check, the counts and the emails.
