#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function propertyNameText(name, is) {
  if (!name) return null;
  if (is.isIdentifier(name) || is.isPrivateIdentifier(name)) return name.text;
  if (is.isStringLiteralLikeNode(name) || is.isNumericLiteral(name)) return name.text;
  return null;
}

function literalValue(node, is, SyntaxKind) {
  if (is.isStringLiteralLikeNode(node)) return node.text;
  if (is.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === SyntaxKind.TrueKeyword) return true;
  if (node.kind === SyntaxKind.FalseKeyword) return false;
  if (node.kind === SyntaxKind.NullKeyword) return null;
  if (is.isPrefixUnaryExpression(node) && is.isNumericLiteral(node.operand)) {
    const value = Number(node.operand.text);
    return node.operator === SyntaxKind.MinusToken ? -value : value;
  }
  return undefined;
}

function expressionPath(node, is, SyntaxKind) {
  if (!node) return null;
  if (is.isIdentifier(node) || node.kind === SyntaxKind.ThisKeyword) return node.getText();
  if (is.isPropertyAccessExpression(node)) {
    const left = expressionPath(node.expression, is, SyntaxKind);
    return left ? `${left}.${node.name.text}` : null;
  }
  if (is.isElementAccessExpression(node)) {
    const left = expressionPath(node.expression, is, SyntaxKind);
    const key = node.argumentExpression
      ? literalValue(node.argumentExpression, is, SyntaxKind)
      : undefined;
    return left && typeof key === "string" ? `${left}.${key}` : null;
  }
  if (is.isCallExpression(node)) {
    const callee = expressionPath(node.expression, is, SyntaxKind);
    if (!callee) return null;
    const args = node.arguments.map((argument) => {
      const value = literalValue(argument, is, SyntaxKind);
      return value === undefined ? "*" : JSON.stringify(value);
    });
    return `${callee}(${args.join(",")})`;
  }
  if (is.isParenthesizedExpression(node)) {
    return expressionPath(node.expression, is, SyntaxKind);
  }
  return null;
}

function unwrapObjectLiteral(initializer, is, SyntaxKind) {
  if (!initializer) return null;
  if (is.isObjectLiteralExpression(initializer)) return initializer;
  if (
    is.isCallExpression(initializer)
    && expressionPath(initializer.expression, is, SyntaxKind) === "Object.freeze"
    && initializer.arguments.length === 1
    && is.isObjectLiteralExpression(initializer.arguments[0])
  ) {
    return initializer.arguments[0];
  }
  return null;
}

function declarationProperties(node, is) {
  if (is.isInterfaceDeclaration(node)) {
    return node.members.map((member) => propertyNameText(member.name, is)).filter(Boolean);
  }
  if (is.isTypeAliasDeclaration(node) && is.isTypeLiteralNode(node.type)) {
    return node.type.members.map((member) => propertyNameText(member.name, is)).filter(Boolean);
  }
  return [];
}

function enclosingFunctionName(node, is) {
  let current = node.parent;
  while (current) {
    if (is.isFunctionDeclaration(current) && current.name) return current.name.text;
    if (is.isMethodDeclaration(current)) return propertyNameText(current.name, is);
    if (is.isFunctionExpression(current) || is.isArrowFunction(current)) {
      const parent = current.parent;
      if (parent && is.isVariableDeclaration(parent) && is.isIdentifier(parent.name)) {
        return parent.name.text;
      }
      if (parent && is.isPropertyAssignment(parent)) return propertyNameText(parent.name, is);
      return null;
    }
    current = current.parent;
  }
  return null;
}

function walk(node, visitor) {
  visitor(node);
  node.forEachChild((child) => walk(child, visitor));
}

function inventorySourceFile(sourceFile, is, SyntaxKind) {
  const staticImports = [];
  const dynamicImports = [];
  const identifiers = new Set();
  const stringLiterals = new Set();
  const numericLiterals = new Set();
  const propertyAccesses = [];
  const objectPropertyLiterals = [];
  const objectDeclarations = Object.create(null);
  const literalDeclarations = Object.create(null);
  const functionDeclarations = [];
  const variableDeclarations = [];
  const calls = [];
  const newExpressions = [];
  const assignmentTargets = [];
  const declarations = [];
  let exportStatementCount = 0;

  for (const statement of sourceFile.statements) {
    if (
      is.isExportDeclaration(statement)
      || is.isExportAssignment(statement)
      || statement.modifiers?.some((modifier) => modifier.kind === SyntaxKind.ExportKeyword)
    ) {
      exportStatementCount += 1;
    }
    if (
      (is.isImportDeclaration(statement) && statement.kind !== SyntaxKind.JSImportDeclaration)
      || is.isExportDeclaration(statement)
    ) {
      if (statement.moduleSpecifier && is.isStringLiteralLikeNode(statement.moduleSpecifier)) {
        staticImports.push(statement.moduleSpecifier.text);
      }
    }
    if (is.isFunctionDeclaration(statement) && statement.name) {
      functionDeclarations.push(statement.name.text);
    }
    if (is.isVariableStatement(statement)) {
      const exported = Boolean(
        statement.modifiers?.some((modifier) => modifier.kind === SyntaxKind.ExportKeyword),
      );
      for (const declaration of statement.declarationList.declarations) {
        if (!is.isIdentifier(declaration.name)) continue;
        variableDeclarations.push({ name: declaration.name.text, exported });
        const literal = declaration.initializer
          ? literalValue(declaration.initializer, is, SyntaxKind)
          : undefined;
        if (literal !== undefined) literalDeclarations[declaration.name.text] = literal;
        const objectLiteral = unwrapObjectLiteral(declaration.initializer, is, SyntaxKind);
        if (objectLiteral) {
          objectDeclarations[declaration.name.text] = objectLiteral.properties
            .map((property) => propertyNameText(property.name, is))
            .filter(Boolean);
        }
      }
    }
  }

  walk(sourceFile, (node) => {
    if (is.isIdentifier(node)) identifiers.add(node.text);
    if (is.isStringLiteralLikeNode(node)) stringLiterals.add(node.text);
    if (
      [
        SyntaxKind.NoSubstitutionTemplateLiteral,
        SyntaxKind.TemplateHead,
        SyntaxKind.TemplateMiddle,
        SyntaxKind.TemplateTail,
      ].includes(node.kind)
      && typeof node.text === "string"
    ) {
      stringLiterals.add(node.text);
    }
    if (is.isNumericLiteral(node)) numericLiterals.add(Number(node.text));

    if (is.isPropertyAssignment(node)) {
      const property = propertyNameText(node.name, is);
      const value = literalValue(node.initializer, is, SyntaxKind);
      if (property && value !== undefined) {
        objectPropertyLiterals.push({
          property,
          value,
          enclosingFunction: enclosingFunctionName(node, is),
        });
      }
    }

    if (is.isPropertyAccessExpression(node) || is.isElementAccessExpression(node)) {
      const accessPath = expressionPath(node, is, SyntaxKind);
      if (accessPath) {
        const separator = accessPath.lastIndexOf(".");
        propertyAccesses.push({
          path: accessPath,
          object: separator >= 0 ? accessPath.slice(0, separator) : "",
          property: separator >= 0 ? accessPath.slice(separator + 1) : accessPath,
        });
      }
    }

    if (is.isBinaryExpression(node) && node.operatorToken.kind === SyntaxKind.EqualsToken) {
      const target = expressionPath(node.left, is, SyntaxKind);
      if (target) assignmentTargets.push(target);
    }

    if (is.isNewExpression(node)) {
      newExpressions.push({
        callee: expressionPath(node.expression, is, SyntaxKind),
        arguments: (node.arguments || []).map((argument) => {
          const value = literalValue(argument, is, SyntaxKind);
          return value === undefined ? null : value;
        }),
      });
    }

    if (is.isCallExpression(node)) {
      const callee = expressionPath(node.expression, is, SyntaxKind);
      const args = node.arguments.map((argument) => {
        const value = literalValue(argument, is, SyntaxKind);
        return value === undefined ? null : value;
      });
      calls.push({
        callee,
        arguments: args,
        path: expressionPath(node, is, SyntaxKind),
        enclosingFunction: enclosingFunctionName(node, is),
      });
      if (node.expression.kind === SyntaxKind.ImportKeyword) {
        const first = node.arguments[0];
        const specifier = first && is.isStringLiteralLikeNode(first) ? first.text : null;
        dynamicImports.push({ specifier, static: specifier !== null });
      }
    }

    if (
      is.isInterfaceDeclaration(node)
      || is.isTypeAliasDeclaration(node)
      || is.isFunctionDeclaration(node)
      || is.isClassDeclaration(node)
      || is.isEnumDeclaration(node)
    ) {
      if (!node.name) return;
      declarations.push({
        name: node.name.text,
        kind: SyntaxKind[node.kind],
        exported: Boolean(
          node.modifiers?.some((modifier) => modifier.kind === SyntaxKind.ExportKeyword),
        ),
        properties: declarationProperties(node, is),
      });
    }
  });

  return {
    filename: sourceFile.fileName,
    isExternalModule: sourceFile.externalModuleIndicator !== undefined,
    topLevelStatementCount: sourceFile.statements.length,
    staticImports,
    dynamicImports,
    identifiers: [...identifiers].sort(),
    stringLiterals: [...stringLiterals].sort(),
    numericLiterals: [...numericLiterals].sort((left, right) => left - right),
    propertyAccesses,
    objectPropertyLiterals,
    objectDeclarations,
    literalDeclarations,
    functionDeclarations,
    variableDeclarations,
    calls,
    newExpressions,
    assignmentTargets,
    declarations,
    exportStatementCount,
  };
}

function normalizeProjectPath(root, value, label) {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes project root: ${value}`);
  }
  return { resolved, relative: relative.split(path.sep).join("/") };
}

function formatDiagnostics(diagnostics, sourceFile, displayFilename) {
  return diagnostics.map((diagnostic) => {
    const position = Number.isInteger(diagnostic.pos) ? diagnostic.pos : 0;
    const location = sourceFile.getLineAndCharacterOfPosition(position);
    const text = String(diagnostic.text || `TypeScript diagnostic TS${diagnostic.code}`);
    return `${displayFilename}:${location.line + 1}:${location.character + 1}: ${text}`;
  }).join("\n");
}

async function main() {
  const request = JSON.parse(fs.readFileSync(0, "utf8"));
  const root = path.resolve(request.root || process.cwd());
  const project = normalizeProjectPath(root, request.project || "jsconfig.json", "AST project");
  const files = (Array.isArray(request.files) ? request.files : [])
    .map((value) => normalizeProjectPath(root, value, "AST inventory path"));

  const [{ API }, is, { SyntaxKind }] = await Promise.all([
    import("typescript/unstable/sync"),
    import("typescript/unstable/ast/is"),
    import("typescript/unstable/ast"),
  ]);

  const api = new API({ cwd: root });
  let snapshot;
  try {
    snapshot = api.updateSnapshot({
      openProjects: [project.resolved],
      openFiles: files.map((file) => file.resolved),
    });
    const compilerProject = snapshot.getProject(project.resolved)
      || snapshot.getProjects().find((candidate) => path.resolve(candidate.configFileName) === project.resolved);
    if (!compilerProject) {
      throw new Error(`TypeScript 7 did not load AST project: ${project.relative}`);
    }

    const result = Object.create(null);
    for (const file of files) {
      const sourceProject = snapshot.getDefaultProjectForFile(file.resolved) || compilerProject;
      const sourceFile = sourceProject.program.getSourceFile(file.resolved);
      if (!sourceFile) {
        throw new Error(`TypeScript 7 does not contain AST source: ${file.relative}`);
      }
      const diagnostics = sourceProject.program.getSyntacticDiagnostics(file.resolved);
      if (diagnostics.length) {
        throw new SyntaxError(formatDiagnostics(diagnostics, sourceFile, file.relative));
      }
      const inventory = inventorySourceFile(sourceFile, is, SyntaxKind);
      inventory.filename = file.relative;
      result[file.relative] = inventory;
    }
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    snapshot?.dispose();
    api.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
