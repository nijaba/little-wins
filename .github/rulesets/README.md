# Repository rulesets

`main.json` protects the default branch: changes arrive through a pull request with the
"CI passed" check green; no force-pushes, no deletion, no bypass.

It is applied to this repository. GitHub only allows rulesets on private repositories with GitHub Pro (or a paid organization
plan); on public repositories they're free. Apply it once the repository is public:

```bash
gh api -X POST repos/<owner>/little-wins/rulesets --input .github/rulesets/main.json
```

To change it later, edit the JSON and update the ruleset in the repository settings
(Settings → Rules → Rulesets) or with `gh api -X PUT repos/<owner>/little-wins/rulesets/<id>`.
