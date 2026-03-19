#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';

function die(message, code = 1) {
  console.error(`Error: ${message}`);
  process.exit(code);
}

function note(message) {
  console.log(`==> ${message}`);
}

function usage() {
  console.log(`Usage:
  vibe setup
  vibe repo init --preview-cmd <command> --preview-port <port> [--preview-base-domain ondomain.dev]
  vibe worktree create <name> --author-name <name> --author-email <email> [--base main]
  vibe commit [git-commit-args...]
  vibe preview start [--port <port>] [--cmd <command>] [--base-domain <domain>]
  vibe hook pre-commit`);
}

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) throw result.error;
  if (!options.allowFailure && result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error(stderr || stdout || `${bin} exited with code ${result.status}`);
  }

  return {
    status: result.status ?? 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function git(args, options = {}) {
  return run('git', args, options);
}

function requireGitRepo(cwd = process.cwd()) {
  try {
    repoRoot(cwd);
  } catch {
    die('Run this inside a git repository.');
  }
}

function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], { cwd }).stdout.trim();
}

function gitCommonDir(cwd = process.cwd()) {
  const root = repoRoot(cwd);
  const common = git(['rev-parse', '--git-common-dir'], { cwd }).stdout.trim();
  return path.resolve(root, common);
}

function repoName(cwd = process.cwd()) {
  return path.basename(path.dirname(gitCommonDir(cwd)));
}

function gitGet(key, cwd = process.cwd()) {
  const result = git(['config', '--get', key], { cwd, allowFailure: true });
  return result.status === 0 ? result.stdout.trim() : '';
}

function gitGetWorktree(key, cwd = process.cwd()) {
  const result = git(['config', '--worktree', '--get', key], { cwd, allowFailure: true });
  return result.status === 0 ? result.stdout.trim() : '';
}

function gitSet(key, value, cwd = process.cwd()) {
  git(['config', key, value], { cwd });
}

function gitSetWorktree(key, value, cwd = process.cwd()) {
  git(['config', '--worktree', key, value], { cwd });
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function ensureRepoDefaults(cwd = process.cwd()) {
  if (!gitGet('doma.committerName', cwd)) gitSet('doma.committerName', 'Dr. Doma', cwd);
  if (!gitGet('doma.committerEmail', cwd)) gitSet('doma.committerEmail', 'doma@ondomain.ai', cwd);
  if (!gitGet('doma.worktreesRoot', cwd)) gitSet('doma.worktreesRoot', '/root/projects/.worktrees', cwd);
  if (!gitGet('doma.previewBaseDomain', cwd)) gitSet('doma.previewBaseDomain', 'ondomain.dev', cwd);
}

function currentBranch(cwd = process.cwd()) {
  return git(['branch', '--show-current'], { cwd }).stdout.trim();
}

function currentWorktreeName(cwd = process.cwd()) {
  return gitGetWorktree('doma.worktreeName', cwd) || currentBranch(cwd);
}

function currentPreviewSlug(cwd = process.cwd()) {
  return gitGetWorktree('doma.previewSlug', cwd) || slugify(currentWorktreeName(cwd));
}

function currentAuthorName(cwd = process.cwd()) {
  return gitGetWorktree('doma.authorName', cwd);
}

function currentAuthorEmail(cwd = process.cwd()) {
  return gitGetWorktree('doma.authorEmail', cwd);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function manifestPath(cwd = process.cwd()) {
  return path.join(repoRoot(cwd), '.vibe.json');
}

function loadManifest(cwd = process.cwd()) {
  const file = manifestPath(cwd);
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveManifest(data, cwd = process.cwd()) {
  const file = manifestPath(cwd);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function ensureHooksWrapper(cwd = process.cwd()) {
  const root = repoRoot(cwd);
  const hooksDir = path.join(root, '.githooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  const hookPath = path.join(hooksDir, 'pre-commit');
  const wrapper = '#!/usr/bin/env bash\nset -euo pipefail\nexec vibe hook pre-commit\n';
  fs.writeFileSync(hookPath, wrapper);
  fs.chmodSync(hookPath, 0o755);
}

function pidIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function startBackground(command, cwd, logPath, pidPath) {
  if (fs.existsSync(pidPath)) {
    const oldPid = Number(fs.readFileSync(pidPath, 'utf8').trim());
    if (Number.isFinite(oldPid) && oldPid > 0 && pidIsAlive(oldPid)) {
      return oldPid;
    }
  }

  const logFd = fs.openSync(logPath, 'a');
  const child = spawn('bash', ['-lc', command], {
    cwd,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: process.env,
  });
  child.unref();
  fs.writeFileSync(pidPath, `${child.pid}\n`);
  fs.closeSync(logFd);
  return child.pid;
}

function ensureNgrokAvailable() {
  const check = run('ngrok', ['version'], { allowFailure: true });
  if (check.status !== 0) die('ngrok is not installed or not on PATH.');
}

function parseGitIdent(ident) {
  const match = ident.trim().match(/^(.*) <([^>]+)>/);
  if (!match) return { name: ident.trim(), email: '' };
  return { name: match[1], email: match[2] };
}

function gitIdent(kind, envVar, cwd = process.cwd()) {
  if (process.env[envVar]) return parseGitIdent(process.env[envVar]);
  return parseGitIdent(git(['var', kind], { cwd }).stdout.trim());
}

function cmdSetup() {
  requireGitRepo();
  gitSet('extensions.worktreeConfig', 'true');
  gitSet('core.hooksPath', '.githooks');
  ensureRepoDefaults();
  ensureHooksWrapper();

  note('Repo configured for cross-repo vibe coding');
  console.log(`  repo: ${repoName()}`);
  console.log(`  committer: ${gitGet('doma.committerName')} <${gitGet('doma.committerEmail')}>`);
  console.log(`  worktrees: ${gitGet('doma.worktreesRoot')}/${repoName()}`);
  console.log(`  preview base domain: ${gitGet('doma.previewBaseDomain')}`);
  console.log(`  hooksPath: ${gitGet('core.hooksPath')}`);
  console.log('\nNext: vibe repo init --preview-cmd "..." --preview-port 3000');
}

function cmdRepoInit(argv) {
  requireGitRepo();
  const { flags } = parseArgs(argv);
  const previewCmd = String(flags['preview-cmd'] || '').trim();
  const previewPort = Number(flags['preview-port'] || 0);
  const previewBaseDomain = String(flags['preview-base-domain'] || gitGet('doma.previewBaseDomain') || 'ondomain.dev').trim();

  if (!previewCmd) die('Missing --preview-cmd.');
  if (!Number.isFinite(previewPort) || previewPort <= 0) die('Missing or invalid --preview-port.');

  const current = loadManifest();
  current.preview = {
    ...(current.preview || {}),
    command: previewCmd,
    port: previewPort,
    baseDomain: previewBaseDomain,
  };
  saveManifest(current);

  note('Wrote repo manifest');
  console.log(`  file: ${manifestPath()}`);
  console.log(`  preview port: ${previewPort}`);
  console.log(`  preview base domain: ${previewBaseDomain}`);
}

function cmdWorktreeCreate(argv) {
  requireGitRepo();
  ensureRepoDefaults();
  const { positional, flags } = parseArgs(argv);
  const name = positional[0];
  if (!name) die('Missing worktree name.');

  const authorName = String(flags['author-name'] || '').trim();
  const authorEmail = String(flags['author-email'] || '').trim();
  const base = String(flags.base || 'main').trim();
  if (!authorName) die('Missing --author-name.');
  if (!authorEmail) die('Missing --author-email.');

  const slug = slugify(name);
  if (!slug) die(`Could not derive a slug from '${name}'.`);

  const worktreesRoot = gitGet('doma.worktreesRoot') || '/root/projects/.worktrees';
  const target = path.join(worktreesRoot, repoName(), slug);
  if (fs.existsSync(target)) die(`Worktree path already exists: ${target}`);

  fs.mkdirSync(path.dirname(target), { recursive: true });

  const branchExists = git(['show-ref', '--verify', '--quiet', `refs/heads/${name}`], { allowFailure: true }).status === 0;
  if (branchExists) {
    git(['worktree', 'add', target, name]);
  } else {
    git(['worktree', 'add', '-b', name, target, base]);
  }

  gitSetWorktree('doma.worktreeName', name, target);
  gitSetWorktree('doma.authorName', authorName, target);
  gitSetWorktree('doma.authorEmail', authorEmail, target);
  gitSetWorktree('doma.previewSlug', slug, target);

  note('Created worktree');
  console.log(`  branch: ${name}`);
  console.log(`  path: ${target}`);
  console.log(`  author: ${authorName} <${authorEmail}>`);
  console.log(`  preview slug: ${slug}`);
}

function cmdCommit(argv) {
  requireGitRepo();
  ensureRepoDefaults();
  if (argv.length === 0) die("Pass normal git commit args, for example: vibe commit -m 'feat: ...'");

  const authorName = currentAuthorName();
  const authorEmail = currentAuthorEmail();
  if (!authorName || !authorEmail) die('No worktree author configured. Create the worktree with vibe worktree create ...');

  const env = {
    ...process.env,
    GIT_COMMITTER_NAME: gitGet('doma.committerName') || 'Dr. Doma',
    GIT_COMMITTER_EMAIL: gitGet('doma.committerEmail') || 'doma@ondomain.ai',
    GIT_AUTHOR_NAME: authorName,
    GIT_AUTHOR_EMAIL: authorEmail,
  };

  const result = spawnSync('git', ['commit', `--author=${authorName} <${authorEmail}>`, ...argv], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });

  process.exit(result.status ?? 0);
}

function cmdPreviewStart(argv) {
  requireGitRepo();
  const { flags } = parseArgs(argv);
  const manifest = loadManifest();
  const root = repoRoot();
  const domaDir = path.join(root, '.doma');
  fs.mkdirSync(domaDir, { recursive: true });

  const port = Number(flags.port || manifest.preview?.port || 0);
  const command = String(flags.cmd || manifest.preview?.command || '').trim();
  const baseDomain = String(flags['base-domain'] || manifest.preview?.baseDomain || gitGet('doma.previewBaseDomain') || 'ondomain.dev').trim();
  const slug = currentPreviewSlug();
  const domain = `${slug}.${baseDomain}`;

  if (!Number.isFinite(port) || port <= 0) die('Missing preview port. Provide --port or define preview.port in .vibe.json.');
  if (!command) die('Missing preview command. Provide --cmd or define preview.command in .vibe.json.');

  const appLog = path.join(domaDir, 'preview-app.log');
  const appPid = path.join(domaDir, 'preview-app.pid');
  const ngrokLog = path.join(domaDir, 'ngrok.log');
  const ngrokPid = path.join(domaDir, 'ngrok.pid');

  const appProcess = startBackground(command, root, appLog, appPid);
  ensureNgrokAvailable();
  const ngrokProcess = startBackground(`ngrok http --url='https://${domain}' '${port}'`, root, ngrokLog, ngrokPid);

  note('Preview started');
  console.log(`  repo: ${repoName()}`);
  console.log(`  worktree: ${currentWorktreeName()}`);
  console.log(`  slug: ${slug}`);
  console.log(`  port: ${port}`);
  console.log(`  domain: https://${domain}`);
  console.log(`  app pid: ${appProcess}`);
  console.log(`  ngrok pid: ${ngrokProcess}`);
  console.log(`  app log: ${appLog}`);
  console.log(`  ngrok log: ${ngrokLog}`);
}

function cmdHookPreCommit() {
  requireGitRepo();
  const expectedCommitterName = gitGet('doma.committerName') || 'Dr. Doma';
  const expectedCommitterEmail = gitGet('doma.committerEmail') || 'doma@ondomain.ai';
  const expectedAuthorName = currentAuthorName();
  const expectedAuthorEmail = currentAuthorEmail();

  const committer = gitIdent('GIT_COMMITTER_IDENT', 'GIT_COMMITTER_IDENT');
  const author = gitIdent('GIT_AUTHOR_IDENT', 'GIT_AUTHOR_IDENT');

  if (committer.name !== expectedCommitterName || committer.email !== expectedCommitterEmail) {
    die(`pre-commit: committer must be ${expectedCommitterName} <${expectedCommitterEmail}>, got ${committer.name} <${committer.email}>`);
  }

  if (expectedAuthorName && author.name !== expectedAuthorName) {
    die(`pre-commit: author name must match worktree config: expected '${expectedAuthorName}', got '${author.name}'`);
  }

  if (expectedAuthorEmail && author.email !== expectedAuthorEmail) {
    die(`pre-commit: author email must match worktree config: expected '${expectedAuthorEmail}', got '${author.email}'`);
  }

  if (expectedAuthorName && expectedAuthorEmail && author.name === expectedCommitterName && author.email === expectedCommitterEmail) {
    die('pre-commit: author cannot be the Dr. Doma committer identity');
  }
}

function main() {
  const [command, subcommand, ...rest] = process.argv.slice(2);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    usage();
    return;
  }

  if (command === 'setup') return cmdSetup();
  if (command === 'repo' && subcommand === 'init') return cmdRepoInit(rest);
  if (command === 'worktree' && subcommand === 'create') return cmdWorktreeCreate(rest);
  if (command === 'commit') return cmdCommit([subcommand, ...rest].filter(Boolean));
  if (command === 'preview' && subcommand === 'start') return cmdPreviewStart(rest);
  if (command === 'hook' && subcommand === 'pre-commit') return cmdHookPreCommit();

  usage();
  process.exit(1);
}

main();
