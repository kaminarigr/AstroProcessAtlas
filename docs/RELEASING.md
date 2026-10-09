# Releases and PixInsight updates

## Current status

Tag-based packaging is configured. GitHub Pages publication is configured but
requires a signed release. The update URL is not active until the first successful
deployment:

`https://kaminarigr.github.io/AstroProcessAtlas/`

The signing step is manual because the author does not yet have a Certified
PixInsight Developer (CPD) identity. GitHub-hosted runners do not include a licensed
PixInsight installation. Do not describe this as fully automated signing.

## One-time setup

1. In GitHub **Settings → Pages**, choose **GitHub Actions** as the source.
2. In PixInsight, use **SigningKeys** to create signing keys and **SubmitCPD** to
   request a CPD identity. Follow the installed **ScriptCodeSigning** documentation,
   sections 11.1 and 11.2. After approval, install PixInsight updates and confirm the
   identity with the `lscpd` console command.
3. Keep the private `.xssk` file and password outside the repository. Local signing
   identities only work for your own PixInsight license; public updates need CPD.
4. Check the supported PixInsight versions before publishing. The candidate feed
   currently targets **1.9.4 only**, conservatively. This is a packaging target,
   not a claim of completed native compatibility testing. Adjust the platform
   range in `tools/build_release.py` only after testing the corresponding versions.

Official references: [PixInsight code signing](https://pixinsight.com/doc/docs/ScriptCodeSigning/ScriptCodeSigning.html)
and [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Automatic downloadable release

1. Update `ASTROPROCESS_ATLAS_VERSION` in `AstroProcessAtlas.js`, the README version
   and `CHANGELOG.md`. Commit the change.
2. Create and push a matching tag, for example `v0.1.1`.
3. **Build release** runs both regression checks, builds a deterministic ZIP with
   the script, license and documentation, and creates a draft GitHub release.
4. Review the release notes and publish the draft for manual downloads.

The ZIP uses PixInsight's `src/scripts/AstroProcessAtlas/` installation layout.
It excludes sample reports, screenshots and development files. A version mismatch
fails the build. Existing assets are never silently overwritten.

You can also run **Build release → Run workflow** for an existing tag.

## Publish a native update

Do this from the exact release tag, with a clean checkout. Do not sign a different
copy of the script.

1. Run PixInsight's **CodeSign** on `AstroProcessAtlas.js` with your CPD keys. It
   produces `AstroProcessAtlas.xsgn` alongside the script.
2. Build the signed package (replace the version and date below):

   ```sh
   python tools/build_release.py --version 0.1.1 --date 20261009 --signature AstroProcessAtlas.xsgn --output dist/signed
   ```

3. Copy `dist/signed/repository-candidate.xri` to `dist/signed/updates.xri`, then
   sign **updates.xri** with CodeSign. Signing must happen after the final ZIP is
   built because the manifest contains its SHA-1 digest. Never edit either file
   after signing.
4. Run `python tools/validate_repository.py dist/signed`. This checks structure,
   signature presence and ZIP checksum, **not cryptographic authenticity**.
   Verify the signatures and installation with PixInsight before publication.
5. Replace the draft's unsigned ZIP and checksum file with the signed ZIP and its
   new `SHA256SUMS.txt`. Add signed `updates.xri`; remove `repository-candidate.xri`
   from the release to avoid confusion. Publish the release.
6. Run **Publish signed PixInsight repository** with the release tag. It downloads
   the signed assets, validates them and deploys them to GitHub Pages.
7. Test **Resources → Updates → Manage Repositories** with the URL above, check
   for updates, install and restart PixInsight. Confirm **Utilities → AstroProcessAtlas**
   and the version in About.

Pages contains the latest complete package and feed. Republishing a newer release
replaces the previous feed; older downloads remain in GitHub Releases. Choose the
latest tag when dispatching publication; the workflow does not infer version order.

## Local checks

```sh
node test_history_report.cjs
node test_workspace_report.cjs
python -m unittest discover -s tools -p "test_release.py"
```

These checks do not replace installation testing in PixInsight. To automate signing
later, use a licensed, secured signing machine with the CPD keys; do not upload keys
to the public repository.
