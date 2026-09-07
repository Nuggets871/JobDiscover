# JobDiscover implementation

Mobile-first French job discovery for any registered user. Public demo contains fictional offers only. Real profiles and feedback require managed authentication and PostgreSQL row-level security. No user profile or feedback is sent to an LLM.

Milestones: repository safeguards; mobile interface; authentication and RLS; onboarding; France Travail; feedback; recommendations; AI enrichment; privacy and abuse prevention; validation and deployment.

Commit messages: English subject only, no body or co-author trailer. Use the repository-local technical identity. Do not rewrite pre-existing history. Initial history may contain the original author's identity; review it before making the repository public.

No credentials, user data, database exports, production logs or real profiles in Git. Scan staged content and CI. Secret scanning is a safeguard, not proof that all personal data is absent. Inspect every staged diff. Rotate any exposed credential immediately, then remove it from history through a separately reviewed procedure.
