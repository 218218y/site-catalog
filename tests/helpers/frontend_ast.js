"use strict";

const ts = require("typescript-5-8");

function scriptKindFor(filename) {
  if (/\.(?:d\.)?tsx?$/i.test(filename)) return ts.ScriptKind.TS;
  if (/\.jsx$/i.test(filename)) return ts.ScriptKind.JSX;
  if (/\.json$/i.test(filename)) return ts.ScriptKind.JSON;
  return ts.ScriptKind.JS;
}

function parseSource(sourceText, filename = "source.js") {
  const sourceFile = ts.createSourceFile(
    filename,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(filename),
  );
  if (sourceFile.parseDiagnostics.length) {
    const diagnostics = sourceFile.parseDiagnostics.map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      if (diagnostic.start == null) return message;
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
      return `${filename}:${line + 1}:${character + 1}: ${message}`;
    });
    throw new SyntaxError(diagnostics.join("\n"));
  }
  return sourceFile;
}

function walk(node, visitor) {
  visitor(node);
  ts.forEachChild(node, (child) => walk(child, visitor));
}

function propertyNameText(name) {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function literalValue(node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    const value = Number(node.operand.text);
    return node.operator === ts.SyntaxKind.MinusToken ? -value : value;
  }
  return undefined;
}

function expressionPath(node) {
  if (!node) return null;
  if (ts.isIdentifier(node) || node.kind === ts.SyntaxKind.ThisKeyword) return node.getText();
  if (ts.isPropertyAccessExpression(node)) {
    const left = expressionPath(node.expression);
    return left ? `${left}.${node.name.text}` : null;
  }
  if (ts.isElementAccessExpression(node)) {
    const left = expressionPath(node.expression);
    const key = node.argumentExpression ? literalValue(node.argumentExpression) : undefined;
    return left && typeof key === "string" ? `${left}.${key}` : null;
  }
  if (ts.isCallExpression(node)) {
    const callee = expressionPath(node.expression);
    if (!callee) return null;
    const args = node.arguments.map((argument) => {
      const value = literalValue(argument);
      return value === undefined ? "*" : JSON.stringify(value);
    });
    return `${callee}(${args.join(",")})`;
  }
  if (ts.isParenthesizedExpression(node)) return expressionPath(node.expression);
  return null;
}

function unwrapObjectLiteral(initializer) {
  if (!initializer) return null;
  if (ts.isObjectLiteralExpression(initializer)) return initializer;
  if (
    ts.isCallExpression(initializer)
    && expressionPath(initializer.expression) === "Object.freeze"
    && initializer.arguments.length === 1
    && ts.isObjectLiteralExpression(initializer.arguments[0])
  ) {
    return initializer.arguments[0];
  }
  return null;
}

function declarationProperties(node) {
  if (ts.isInterfaceDeclaration(node)) {
    return node.members.map((member) => propertyNameText(member.name)).filter(Boolean);
  }
  if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
    return node.type.members.map((member) => propertyNameText(member.name)).filter(Boolean);
  }
  return [];
}

function inventorySource(sourceText, filename = "source.js") {
  const sourceFile = parseSource(sourceText, filename);
  const staticImports = [];
  const dynamicImports = [];
  const identifiers = new Set();
  const propertyAccesses = [];
  const objectDeclarations = Object.create(null);
  const literalDeclarations = Object.create(null);
  const functionDeclarations = [];
  const calls = [];
  const newExpressions = [];
  const assignmentTargets = [];
  const declarations = [];
  let exportStatementCount = 0;

  for (const statement of sourceFile.statements) {
    if (
      ts.isExportDeclaration(statement)
      || ts.isExportAssignment(statement)
      || statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      exportStatementCount += 1;
    }
    if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
      if (statement.moduleSpecifier && ts.isStringLiteralLike(statement.moduleSpecifier)) {
        staticImports.push(statement.moduleSpecifier.text);
      }
    }
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      functionDeclarations.push(statement.name.text);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const literal = declaration.initializer ? literalValue(declaration.initializer) : undefined;
        if (literal !== undefined) literalDeclarations[declaration.name.text] = literal;
        const objectLiteral = unwrapObjectLiteral(declaration.initializer);
        if (objectLiteral) {
          objectDeclarations[declaration.name.text] = objectLiteral.properties
            .map((property) => propertyNameText(property.name))
            .filter(Boolean);
        }
      }
    }
  }

  walk(sourceFile, (node) => {
    if (ts.isIdentifier(node)) identifiers.add(node.text);

    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const path = expressionPath(node);
      if (path) {
        const separator = path.lastIndexOf(".");
        propertyAccesses.push({
          path,
          object: separator >= 0 ? path.slice(0, separator) : "",
          property: separator >= 0 ? path.slice(separator + 1) : path,
        });
      }
    }

    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const target = expressionPath(node.left);
      if (target) assignmentTargets.push(target);
    }

    if (ts.isNewExpression(node)) {
      newExpressions.push({
        callee: expressionPath(node.expression),
        arguments: (node.arguments || []).map((argument) => {
          const value = literalValue(argument);
          return value === undefined ? null : value;
        }),
      });
    }

    if (ts.isCallExpression(node)) {
      const callee = expressionPath(node.expression);
      const args = node.arguments.map((argument) => {
        const value = literalValue(argument);
        return value === undefined ? null : value;
      });
      calls.push({ callee, arguments: args, path: expressionPath(node) });
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const first = node.arguments[0];
        const specifier = first && ts.isStringLiteralLike(first) ? first.text : null;
        dynamicImports.push({ specifier, static: specifier !== null });
      }
    }

    if (
      ts.isInterfaceDeclaration(node)
      || ts.isTypeAliasDeclaration(node)
      || ts.isFunctionDeclaration(node)
      || ts.isClassDeclaration(node)
      || ts.isEnumDeclaration(node)
    ) {
      if (!node.name) return;
      declarations.push({
        name: node.name.text,
        kind: ts.SyntaxKind[node.kind],
        exported: Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)),
        properties: declarationProperties(node),
      });
    }
  });

  return {
    filename,
    isExternalModule: ts.isExternalModule(sourceFile),
    topLevelStatementCount: sourceFile.statements.length,
    staticImports,
    dynamicImports,
    identifiers: [...identifiers].sort(),
    propertyAccesses,
    objectDeclarations,
    literalDeclarations,
    functionDeclarations,
    calls,
    newExpressions,
    assignmentTargets,
    declarations,
    exportStatementCount,
  };
}

function findCalls(inventory, callee) {
  return inventory.calls.filter((call) => call.callee === callee);
}

function hasPropertyPath(inventory, path) {
  return inventory.propertyAccesses.some((access) => access.path === path);
}

module.exports = {
  expressionPath,
  findCalls,
  hasPropertyPath,
  inventorySource,
  parseSource,
  propertyNameText,
  walk,
};
