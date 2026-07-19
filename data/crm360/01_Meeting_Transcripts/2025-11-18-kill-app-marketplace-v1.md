CRM360 — Meeting Transcript

Date: 2025-11-18

Topic: Decision Meeting — Kill App Marketplace v1 (CRM360-9)

Attendees: Maya Chen (VP Product), Ben Carter (CTO), Raj Patel (Principal Engineer), Priya Nair (Staff Engineer), Nina Torres (Customer Success Lead), Sofia Rossi (Frontend Lead)

  

\[00:00:12\] Ben Carter: We're here to decide the future of App Marketplace v1. Maya, you called the meeting. Walk us through the data.

  

\[00:00:34\] Maya Chen: I'll be direct because the numbers are direct. We launched the marketplace roughly six months ago. In that window we have three apps published. Two of those three we built in-house to make the catalog not look empty. So one genuinely external partner app.

  

\[00:01:14\] Sofia Rossi: And usage on that one external app?

  

\[00:01:22\] Maya Chen: Negligible. Under twenty installs. Meanwhile our first-party Slack and Zapier connectors, which we shipped almost as a side project, are driving about ninety percent of all integration usage on the platform.

  

\[00:01:58\] Nina Torres: That matches what I hear from customers. Nobody asks "where's the marketplace." They ask "do you connect to Slack, do you connect to HubSpot." They want the integration to already exist and just work, not to shop for a third-party app.

  

\[00:02:35\] Raj Patel: And the cost side is ugly. The security review never scaled. Every prospective partner app is a manual data-access review, and we've had maybe two engineers spending real time gatekeeping for a pipeline that produced one external app. We also froze public API surfaces to keep the partner contract stable, which slowed our own core work.

  

\[00:03:20\] Priya Nair: I don't want to say I told you so, so I'll say it gently — this is close to what I flagged at the kickoff in May. The API-stability cost and the unproven self-serve demand. I'm not raising it to score a point; I'm raising it because I want us to actually learn it this time.

  

\[00:03:55\] Maya Chen: You did flag it, and it's fair to name that. Credit where it's due. The demand for self-serve partner publishing just wasn't there at our stage, and the cost to keep the door open was high.

  

\[00:04:30\] Ben Carter: So the recommendation on the table?

  

\[00:04:38\] Maya Chen: Kill App Marketplace v1. Sunset the catalog and partner onboarding. Redirect that energy into first-party connectors — Slack, Zapier, HubSpot import — and a stable internal integration framework that we own and maintain.

  

\[00:05:12\] Sofia Rossi: What happens to the one external partner and their installs?

  

\[00:05:20\] Nina Torres: Small enough that I can reach out personally, give them a migration path or a deprecation window. It's a handful of customers. Manageable.

  

\[00:05:48\] Raj Patel: The internal integration framework is the right investment. Same building blocks — connectors, auth, sync — but maintained by us against internal contracts we can change freely. No external freeze on the public API. That's CRM360-8 as a direction.

  

\[00:06:25\] Priya Nair: And to be clear, killing the self-serve marketplace doesn't mean killing the public API or webhooks. Those still have value for individual customers wiring up their own automations. We're killing the self-serve partner-publishing product, not the API.

  

\[00:06:58\] Ben Carter: Correct, and important distinction. The API stays. The marketplace-as-a-product goes.

  

\[00:07:20\] Ben Carter: Alright. I approve the shutdown. App Marketplace v1 is killed, recorded as CRM360-9. We redirect to first-party connectors and an internal integration framework, CRM360-8. Before we assign actions — Maya, let's capture the lesson so it survives us.

  

\[00:07:58\] Maya Chen: The lesson: don't build a self-serve platform to test unproven demand. Validate demand with a few hand-built integrations first. And don't take on an external API-stability commitment while the core product is still moving fast. If we ever consider a marketplace again, those two conditions have to be met first.

  

\[00:08:40\] Priya Nair: I'd add one more: usage told the truth. Ninety percent first-party. Follow where users actually go, not where we hoped they'd go.

  

\[00:09:05\] Ben Carter: Well said. Write that lesson into the CRM360-9 decision record so it's findable. Actions.

  

\[00:09:25\] Maya Chen: I'll write the CRM360-9 shutdown decision with the lessons section, and the comms plan.

  

\[00:09:44\] Sofia Rossi: I'll pull the catalog and install UI behind a flag and plan the removal.

  

\[00:10:02\] Nina Torres: I'll contact the affected partner and their customers with a deprecation window.

  

\[00:10:18\] Raj Patel: I'll turn the integration-framework direction into the CRM360-8 design doc.

  

\[00:10:35\] Ben Carter: Good. Decision made, lesson captured. Thanks everyone.

  

Action Items:

\- Ben: Approved shutdown of App Marketplace v1 (CRM360-9); redirect to first-party connectors + internal framework (CRM360-8).

\- Maya: Author CRM360-9 decision record with explicit lessons; comms plan.

\- Sofia: Flag off + remove catalog and install UI.

\- Nina: Notify affected partner/customers with deprecation window.

\- Raj: Write CRM360-8 first-party integration framework design.

\- Lesson recorded: validate demand with hand-built integrations before building a self-serve platform; don't commit to external API stability while core is still moving; usage was 90% first-party.
