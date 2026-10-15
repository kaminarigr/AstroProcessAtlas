# Issues, notifications and resolution

## New reports and proposals

Both issue forms default to assigning `kaminarigr`. After the templates reach the
default branch, new submissions through those forms are assigned to the maintainer
and use GitHub's assignment notifications. This does not change the maintainer's
personal email/notification settings or update existing issues. Blank issues and
issues created through an API may need manual assignment.

For broader coverage, open the repository and choose **Watch → Custom → Issues**.
In account **Settings → Notifications**, enable email for the relevant activity
if desired. Assignment and Watch do not bypass muted threads or personal settings.
No email credentials, mailing service or additional Actions secrets are required.

## Track a fix from report to release

1. Read the report, request missing reproduction details if needed, and record the
   actual issue number. Use `bug` or `enhancement` labels when available.
2. Link the change using `Refs #<actual issue number>` in the commit or pull
   request. The PR template has fields for the issue and target release. Never
   invent an issue number or close an unrelated report.
3. Add a concise changelog entry under **Unreleased**, linking the issue. Move the
   entry to the version section when preparing the release. Link the same issue
   in the public release notes.
4. After checks pass, optionally comment that the fix is committed and awaiting a
   release. Keep the issue open while the fix is not yet available to users.
5. Publish the release and verify its download/update feed. Comment on the issue
   with the released version, release link, short fix description and verification
   limits. Then choose **Close issue → Completed**. Subscribers receive updates
   according to their GitHub notification settings.
6. If the reporter reproduces the problem with that version, reopen the issue and
   continue the investigation. Suggestions can follow the same release tracking.

`Fixes #…` and `Closes #…` can close an issue automatically when the change reaches
the default branch. Use them only when closing on merge is intentional; they do
not mean a release has been published or installed. `Refs #…` keeps that distinction.

## Comment templates

Replace all placeholders before posting. These examples do not post automatically.

**Committed, awaiting release**

> The fix is committed in `<commit>`. Checks: `<results>`. It is planned for
> `<version>` and has not been released yet. PixInsight verification: `<status>`.

**Released and resolved**

> Fixed in **<version>**: <short description>.
> Release: <published release URL>.
> Update through PixInsight and generate a fresh HTML/replay script if relevant.
> Verified with: <actual checks and native test status>.
> If it still occurs with this version, reply here so we can investigate/reopen.

For a duplicate or an unimplemented proposal, explain the decision and link the
relevant discussion. Do not label it fixed or claim it shipped in a release.

## Ελληνικά

Οι φόρμες αναφοράς και πρότασης αναθέτουν προεπιλεγμένα τις νέες εγγραφές στο
`kaminarigr`, αφού γίνουν push στο default branch. Οι ειδοποιήσεις και το email
εξαρτώνται από τις προσωπικές ρυθμίσεις του GitHub. Για όλες τις αναφορές, ακόμη
και εκτός φόρμας, ενεργοποίησε **Watch → Custom → Issues**.

Κάθε διόρθωση συνδέεται με το πραγματικό issue μέσω `Refs #…`, καταγράφεται στο
changelog και στην έκδοση που την περιλαμβάνει. Το issue μένει ανοιχτό όσο η λύση
δεν έχει κυκλοφορήσει. Μετά τη δημοσίευση και τον έλεγχο της αναβάθμισης, γράφουμε
σχόλιο με έκδοση και σύνδεσμο release και επιλέγουμε **Close issue → Completed**.
Οι χρήστες που παρακολουθούν το issue ενημερώνονται σύμφωνα με τις ρυθμίσεις τους.

Ενδεικτικό σχόλιο επίλυσης:

> Διορθώθηκε στην **<έκδοση>**: <σύντομη περιγραφή>.
> Λήψη και πληροφορίες: <σύνδεσμος δημοσιευμένου release>.
> Κάνε αναβάθμιση από το PixInsight και, όπου χρειάζεται, δημιούργησε νέο report/replay.
> Έλεγχοι: <τι δοκιμάστηκε πραγματικά>.
> Αν επιμένει στην έκδοση αυτή, γράψε εδώ για να το ελέγξουμε ξανά.

## GitHub references

- [Issue form default assignees](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [Notifications](https://docs.github.com/en/subscriptions-and-notifications/concepts/about-notifications)
- [Linking a pull request to an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
