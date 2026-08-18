# Form → GitHub automation setup

Replaces the manual Colab/CSV workflow: a submission on either the mentor or
mentee sign-up form is turned into a profile markdown file (and photo) and
committed straight to this repo, which then rebuilds and deploys the site
automatically.

Two independent pieces:

1. **`.github/workflows/pages.yml`** — makes GitHub Pages build via Actions on
   every push to `main`, instead of the manual `jekyll build` → commit `docs/`
   → push flow described in the old README.
2. **`apps-script/Code.gs`** — a Google Apps Script that runs on form submit
   and commits the generated files via the GitHub API.

## 1. Switch GitHub Pages to Actions-based deploy

In the repo on GitHub: **Settings → Pages → Build and deployment → Source**,
change it to **GitHub Actions**. (It's currently set to deploy from a branch,
per the existing README's manual `docs/` workflow.) Once switched, any push to
`main` that touches the site will trigger `pages.yml` to build and publish —
no more manual local `bundle exec jekyll build` + commit of `docs/`.

## 2. Create the GitHub token

Already in progress — a fine-grained PAT scoped to only `SASE-Drexel/mentorship-2026`,
with **Contents: Read and write** (and **Metadata: Read-only**, forced on).
Keep the token somewhere safe once generated; you'll paste it into Apps Script
in step 4 and it won't be shown again after that.

## 3. Create the Apps Script project

1. Go to [script.google.com](https://script.google.com) → **New project**.
2. Name it something like `Mentorship Form → GitHub`.
3. Delete the default `Code.gs` contents and paste in the contents of
   [`apps-script/Code.gs`](apps-script/Code.gs) from this repo.
4. Near the top of the file, fill in:
   - `MENTOR_FORM_ID` and `MENTEE_FORM_ID` — the ID segment from each form's
     edit URL: `https://docs.google.com/forms/d/`**`<ID>`**`/edit`.
5. Save (Ctrl/Cmd+S).

## 4. Store the GitHub token

In the Apps Script editor: **Project Settings** (gear icon, left sidebar) →
scroll to **Script Properties** → **Add script property**.
- Property: `GITHUB_TOKEN`
- Value: the PAT from step 2

This keeps the token out of the script source entirely.

## 5. Install the triggers

Back in the **Editor** tab, select the `installTriggers` function from the
function dropdown at the top, then click **Run**.

- The first run will prompt an OAuth consent screen — this script needs
  access to Forms (read responses), Drive (read uploaded photos), and
  external requests (commit to GitHub). Review and allow.
- Check **Executions** (left sidebar) to confirm it ran without error. This
  creates two installable "on form submit" triggers, one per form.

## 6. Test before relying on it

Rather than submitting throwaway test responses to the real forms, replay the
most recent real response through the pipeline:

- Select `testMentorMapping` from the function dropdown → **Run**.
- Select `testMenteeMapping` from the function dropdown → **Run**.

Check:
- **Executions** log for errors. A mismatched question title throws
  immediately and names exactly which question(s) didn't match — that's the
  fix for the `KeyError` bug in the old Colab script, where a mismatch failed
  silently until a much later line.
- The repo's `_mentors` / `_mentees` folders and `assets/images/` for the new
  commit.
- The live site (after the Actions build finishes — check the **Actions** tab)
  to confirm the profile renders correctly.

Once both test runs look right, the pipeline is live — any real form
submission from here on will trigger the same path automatically via the
installed triggers.

## Notes for next year

- `SITE_REPO_SLUG` in `Code.gs` is baked into the public image URL
  (`https://sase-drexel.github.io/<slug>/assets/images/...`) — bump it when
  the site moves to `mentorship-2027`.
- If a form question gets reworded, update the matching string in
  `MENTOR_CONFIG.questions` / `MENTEE_CONFIG.questions` in `Code.gs` to match
  — the error message from `getAnswers_` will tell you exactly which one
  changed if you forget.
- Re-run `installTriggers` if you ever reopen/republish the forms and the IDs
  change (they normally don't).
