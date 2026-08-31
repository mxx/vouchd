#!/usr/bin/env node
/**
 * Enforces AGENTS.md rule 2: no function body over 40 lines.
 *
 * Counts only lines that carry logic — blank lines and comment-only lines
 * are free — so rule 1 ("code is the documentation") never costs you budget
 * against rule 2. See AGENTS.md "Why the two rules don't fight."
 *
 * Parses with the TypeScript compiler API (already a devDependency) rather
 * than regex: arrow functions, methods and accessors all have to be caught,
 * and a regex that finds them reliably is harder to trust than the real
 * parser we already ship.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const LIMIT = 40;
const ROOTS = ["src", "tests"];

function sourceFiles(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (/\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

function carriesLogic(line) {
  const trimmed = line.trim();
  if (trimmed === "") return false;
  return !(trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*"));
}

/** Body lines between the braces, excluding blanks and comment-only lines. */
function logicLineCount(node, sourceFile, lines) {
  if (!node.body || !ts.isBlock(node.body)) return 0; // expression-bodied arrow
  const open = sourceFile.getLineAndCharacterOfPosition(node.body.getStart(sourceFile)).line;
  const close = sourceFile.getLineAndCharacterOfPosition(node.body.getEnd()).line;
  return lines.slice(open + 1, close).filter(carriesLogic).length;
}

function functionName(node) {
  if (node.name) return node.name.getText();
  const parent = node.parent;
  if (parent && (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent))) {
    return parent.name.getText();
  }
  if (ts.isConstructorDeclaration(node)) return "constructor";
  return "<anonymous>";
}

/**
 * A `describe(...)` callback is a container, not logic: splitting one test
 * into three makes it *longer*, which is the opposite of what this rule is
 * for. `it`/`test` callbacks are deliberately NOT exempt — an over-long test
 * body is a real smell, and splitting it produces failures that name the
 * case.
 */
const SUITE_CONTAINERS = new Set(["describe", "suite"]);

function isSuiteContainerCallback(node) {
  const call = node.parent;
  if (!call || !ts.isCallExpression(call)) return false;
  const callee = call.expression;
  const root = ts.isPropertyAccessExpression(callee) ? callee.expression : callee;
  return ts.isIdentifier(root) && SUITE_CONTAINERS.has(root.text);
}

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessor(node) ||
    ts.isSetAccessor(node)
  );
}

function violationsIn(path) {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const found = [];
  const visit = (node) => {
    if (isFunctionLike(node) && !isSuiteContainerCallback(node)) {
      const count = logicLineCount(node, sourceFile, lines);
      if (count > LIMIT) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        found.push({ path, line, name: functionName(node), count });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

const violations = ROOTS.flatMap((root) => sourceFiles(root)).flatMap(violationsIn);

for (const { path, line, name, count } of violations) {
  console.error(`${relative(".", path)}:${line}  ${name}() is ${count} logic lines (limit ${LIMIT})`);
}

if (violations.length > 0) {
  console.error(
    `\n${violations.length} function(s) over the limit. Extract a named sub-step — ` +
      `don't delete comments to fit (AGENTS.md rule 2).`,
  );
  process.exit(1);
}

console.log(`✓ all functions within ${LIMIT} logic lines`);
