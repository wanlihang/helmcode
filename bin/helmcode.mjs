#!/usr/bin/env node

import { install, status, list, update } from '../install.mjs';

// ── Argument parser ─────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0]?.startsWith('-') ? undefined : args[0];
  const options = {};

  for (let i = command ? 1 : 0; i < args.length; i++) {
    switch (args[i]) {
      case '--preset':
        options.preset = args[++i];
        break;
      case '--project':
        options.project = args[++i];
        break;
      case '--force':
        options.force = true;
        break;
      case '--global-loader':
        options.globalLoader = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (args[i].startsWith('-')) {
          console.error(`Unknown option: ${args[i]}`);
          process.exit(1);
        }
    }
  }

  return { command, options };
}

// ── Help ─────────────────────────────────────────────────

function showHelp() {
  console.log(`
HelmCode — AI编程工作流: clarify → implement → verify

Usage:
  helmcode <command> [options]

Commands:
  install    Install HelmCode to a project
  status     Show installation status
  update     Update HelmCode files
  list       List available presets

Options:
  --preset <name>        Preset: java-ddd | minimal (auto-detect)
  --project <path>       Target project directory (default: current)
  --force                Skip confirmation
  --global-loader        Also install global helmcode-loader skill
  --help, -h             Show this help

Examples:
  helmcode install                           # Auto-detect, install to current dir
  helmcode install --preset java-ddd         # Java DDD full install
  helmcode install --project ~/my-project    # Specify target project
  helmcode install --global-loader           # Also install global loader
  helmcode status                            # Check installation status
  helmcode list                              # List available presets
`);
}

// ── Main ─────────────────────────────────────────────────

const { command, options } = parseArgs(process.argv);

if (options.help || !command) {
  showHelp();
  process.exit(0);
}

switch (command) {
  case 'install':
    await install(options);
    break;
  case 'status':
    await status(options);
    break;
  case 'update':
    await update(options);
    break;
  case 'list':
    await list();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error('Run "helmcode --help" for usage');
    process.exit(1);
}
