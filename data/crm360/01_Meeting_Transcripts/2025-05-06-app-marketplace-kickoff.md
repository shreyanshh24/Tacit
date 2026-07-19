CRM360 — Meeting Transcript

Date: 2025-05-06

Topic: App Marketplace v1 — Kickoff

Attendees: Maya Chen (VP Product), Ben Carter (CTO), Raj Patel (Principal Engineer), Priya Nair (Staff Engineer), Sofia Rossi (Frontend Lead), Nina Torres (Customer Success Lead), Alex Wu (Designer)

  

\[00:00:11\] Maya Chen: This is the fun one. I want to pitch the App Marketplace. A self-serve marketplace on our public API where third-party partners build and publish apps for CRM360 users. Think of it as our growth flywheel — every partner app makes the platform stickier, and we don't build those integrations ourselves.

  

\[00:00:52\] Sofia Rossi: So partners register, get API keys, build against our public API, and users install their apps from a catalog inside CRM360?

  

\[00:01:14\] Maya Chen: Exactly. Self-serve onboarding for developers, a catalog UI, install flow, and a revenue share down the line. Salesforce has AppExchange, HubSpot has a marketplace. This is table stakes for a platform play and it's a moat.

  

\[00:01:50\] Nina Torres: Customers do ask for integrations constantly. If a marketplace means they can self-serve instead of filing a request with us, that's less queue for my team.

  

\[00:02:20\] Alex Wu: I can see a clean catalog experience — categories, ratings, screenshots, one-click install. That part is designable and honestly exciting.

  

\[00:02:48\] Priya Nair: I want to raise a concern before we get too far down the road. Two, actually. First — our public API isn't stable yet. We're still reshaping endpoints as we build core modules. If external developers build against it now, every change we make breaks their apps and generates support load we can't absorb.

  

\[00:03:35\] Raj Patel: That's real. We've broken our own frontend against the API twice this quarter. An external contract means we freeze surfaces we're still actively changing.

  

\[00:04:08\] Priya Nair: Second concern — the demand assumption. We're assuming partners want to build on us self-serve. We don't have evidence of that. A marketplace with no apps is a ghost town, and building the whole install-and-billing pipeline is a big lift to test an unproven demand.

  

\[00:04:52\] Maya Chen: The demand is exactly why we build it — you don't get partners without a place for them to publish. Chicken and egg. Someone has to lay the egg.

  

\[00:05:26\] Priya Nair: Or we validate demand cheaper first. We could hand-build two or three integrations partners are literally asking for, see if the usage is there, then decide whether the self-serve platform is worth it.

  

\[00:06:00\] Sofia Rossi: The security review also worries me a little. Third-party code touching customer CRM data — every app is a data-access review. Who does those reviews and how do they scale?

  

\[00:06:38\] Maya Chen: We'll start with a lightweight review and tighten as volume grows. I don't want to over-engineer the gate before we have apps to gate.

  

\[00:07:10\] Priya Nair: That's the part I'd flag hardest. A light security review that doesn't scale is how you either bottleneck or wave through something you shouldn't. But — I've said my piece. If we go, I'll help make it as safe as we can.

  

\[00:07:48\] Ben Carter: I hear the risks, and Priya, they're on the record. But I think the platform bet is worth making now. Being late to a marketplace is its own risk. Here's my call: we green-light App Marketplace v1. We scope it as a v1 — real catalog, real install flow, self-serve partner onboarding — and we accept the public API stabilizes as part of the work.

  

\[00:08:30\] Maya Chen: That's the green light I wanted. Thank you.

  

\[00:08:52\] Ben Carter: Priya, I want your API-stability concern tracked as a workstream, not a footnote. Marketplace only ships once the public API surfaces it depends on are versioned.

  

\[00:09:25\] Priya Nair: I can work with that. Versioning first is the right sequencing at least.

  

\[00:09:50\] Raj Patel: I'll scope the API versioning and the partner auth model — separate credentials, scoped tokens, per-app rate limits.

  

\[00:10:22\] Maya Chen: I'll own the go-to-market and the partner recruiting. I'll line up a few design partners to seed the catalog.

  

\[00:10:48\] Nina Torres: I'll collect the top integration requests from customers so we know what partners should build first.

  

\[00:11:15\] Ben Carter: Good. This is a real bet. Let's make it. Actions on the board.

  

Action Items:

\- Ben: Green-lit App Marketplace v1 (self-serve partner marketplace on public API).

\- Raj: Scope public API versioning + partner auth (scoped tokens, per-app rate limits). Versioning is a ship prerequisite.

\- Maya: Own GTM + recruit design-partner apps to seed the catalog.

\- Nina: Compile top customer integration requests.

\- Priya: Track API-stability workstream; help define security-review process.

\- Sofia/Alex: Draft catalog + install-flow designs.
