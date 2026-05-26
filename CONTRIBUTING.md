# Contributing to HelmCode

## Development Setup

```bash
# Clone
git clone https://github.com/mojue/helmcode.git
cd helmcode

# Test locally
node bin/helmcode.mjs install --preset java-ddd --project /tmp/test-project --force

# Verify
node bin/helmcode.mjs status --project /tmp/test-project
```

## Project Structure

```
HelmCode/
├── bin/helmcode.mjs        # CLI entry point
├── install.mjs              # Install logic
├── core/                    # Skills (each has SKILL.md + optional references/)
├── standards/java-ddd/      # Java DDD standards + patterns
├── scripts/                 # Verify scripts
├── templates/               # Contract & brief templates
├── loader/                  # Global loader skill
├── commands/                # Slash commands
└── presets/                 # Preset definitions
```

## How to Contribute

### Reporting Issues

- Use [GitHub Issues](https://github.com/mojue/helmcode/issues)
- Include: HelmCode version, Node version, project type, error output

### Adding Standards

1. Create a new directory under `standards/{preset}/`
2. Include: `standards.md`, `review-rules.md`, `test-standards.md`
3. Add patterns in `standards/{preset}/patterns/`
4. Register the preset in `install.mjs` `PRESETS` object
5. Test with a real project

### Adding Skills

1. Create `core/{skill-name}/SKILL.md` with YAML frontmatter
2. Add references in `core/{skill-name}/references/` if needed
3. Register in the appropriate preset(s)
4. Test the skill in Claude Code

### Adding Verify Scripts

1. Create `scripts/verify-*.mjs`
2. Scripts should exit with code 0 on pass, 1 on fail
3. Output `✅` for pass, `❌` for fail, `⚠️` for warnings
4. Do not hardcode project-specific package names

## Guidelines

- **No runtime dependencies** — HelmCode is pure Node.js
- **No project-specific hardcoding** — Scripts must work with any project
- **Context budget matters** — Keep skill files minimal
- **Standards are data** — Rules go in `.md` files, not in code

## Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make changes with clear commit messages
4. Test with `node bin/helmcode.mjs install --preset java-ddd --project /tmp/test --force`
5. Submit PR with description of changes